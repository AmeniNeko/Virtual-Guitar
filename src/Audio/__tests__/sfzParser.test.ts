/**
 * sfzParser.test.ts — SFZ 解析与规范化
 *
 * 这里的断言直接对应四套真实音源的强制语义：
 * 如果同级 header 会互相继承，电吉他的强力度层会全部静音。
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { adaptSFZText } from '../InstrumentAdapter';
import { INSTRUMENT_PRESETS } from '../InstrumentPreset';
import { countRegions, parseSFZ } from '../sfz/SFZParser';
import { resolveOpcodes } from '../sfz/SFZTypes';
import { INSTRUMENT_IDS, type InstrumentId } from '../types';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function readSfz(id: InstrumentId): string {
  const preset = INSTRUMENT_PRESETS[id];
  const file = join(PROJECT_ROOT, 'public', preset.sfzDir.replace(/^\//, ''), preset.sfzFile);
  return readFileSync(file, 'utf8');
}

function adapt(id: InstrumentId) {
  const preset = INSTRUMENT_PRESETS[id];
  return adaptSFZText(readSfz(id), { instrument: id, sfzBaseDir: preset.sfzDir });
}

describe('SFZ 结构解析', () => {
  it('同级 header 之间不继承（group 回退到 global）', () => {
    const doc = parseSFZ(`
      <global>
      volume=-3
      <group>
      lokey=35 hikey=38 hivel=92
      <region>
      sample=a.wav
      <group>
      lokey=35 hikey=38 lovel=93
      <region>
      sample=b.wav
    `);

    const [, second] = doc.groups;
    const ops = resolveOpcodes(doc.globals, second.opcodes, second.regions[0].opcodes);

    expect(ops.get('volume')).toBe('-3'); // 继承自 global
    expect(ops.get('lovel')).toBe('93');
    // 若 group 会继承，这里会拿到上一个 group 的 hivel=92，区间变成空
    expect(ops.has('hivel')).toBe(false);
  });

  it('同级 header 之间不继承（region 回退到 group）', () => {
    const { regions } = adaptSFZText(
      `
      <global>
      <group>
      lokey=39 hikey=40 pitch_keycenter=40
      <region>
      hivel=82
      sample=soft.wav
      <region>
      lovel=83
      sample=loud.wav
    `,
      { instrument: 'steel_acoustic', sfzBaseDir: '/' },
    );

    expect(regions).toHaveLength(2);
    expect(regions[0].velocityHigh).toBe(82);
    // 若 region 会继承，第二个 region 会拿到 hivel=82，区间 83..82 为空
    expect(regions[1].velocityLow).toBe(83);
    expect(regions[1].velocityHigh).toBe(127);
  });

  it('key= 展开为 lokey/hikey/pitch_keycenter', () => {
    const { regions } = adaptSFZText(
      `<global>
       <group>
       key=72
       <region>
       sample=c.wav`,
      { instrument: 'steel_acoustic', sfzBaseDir: '/' },
    );

    expect(regions[0].keyLow).toBe(72);
    expect(regions[0].keyHigh).toBe(72);
    expect(regions[0].rootKey).toBe(72);
  });

  it('lorand / hirand 不会被当成 lokey / hikey / hivel', () => {
    const { regions } = adaptSFZText(
      `<global>
       <group>
       <region>
       lorand=0 hirand=0.25
       sample=rr.wav`,
      { instrument: 'electric_clean', sfzBaseDir: '/' },
    );

    expect(regions[0].keyLow).toBe(0);
    expect(regions[0].keyHigh).toBe(127);
    expect(regions[0].velocityLow).toBe(1);
    expect(regions[0].velocityHigh).toBe(127);
  });

  it('剥离行注释与块注释，并读取 //+ 元数据', () => {
    const doc = parseSFZ(`
      //+ Name: Test Bank
      // 这是行注释
      /* 这是块注释
         <region>
         sample=ignored.wav */
      <global>
      volume=-6 // 行尾注释
      <group>
      <region>
      sample=real.wav
    `);

    expect(doc.metadata.name).toBe('Test Bank');
    expect(doc.globals.get('volume')).toBe('-6');
    expect(countRegions(doc)).toBe(1);
  });

  it('丢弃非法区间并记录警告', () => {
    const { regions, warnings } = adaptSFZText(
      `<global>
       <group>
       <region>
       lokey=70 hikey=60
       sample=bad.wav`,
      { instrument: 'steel_acoustic', sfzBaseDir: '/' },
    );

    expect(regions).toHaveLength(0);
    expect(warnings.some((w) => w.includes('lokey'))).toBe(true);
  });
});

describe('四套真实音源', () => {
  const expectedRegions: Record<InstrumentId, number> = {
    steel_acoustic: 59,
    nylon_classical: 48,
    electric_clean: 120,
    electric_overdrive: 120,
  };

  for (const id of INSTRUMENT_IDS) {
    it(`${id}: region 数量为 ${expectedRegions[id]}，且没有空区间`, () => {
      const { regions } = adapt(id);

      expect(regions).toHaveLength(expectedRegions[id]);
      for (const region of regions) {
        expect(region.keyLow).toBeLessThanOrEqual(region.keyHigh);
        expect(region.velocityLow).toBeLessThanOrEqual(region.velocityHigh);
        expect(region.sampleUrl.startsWith('/sounds/')).toBe(true);
      }
    });
  }

  it('电吉他强力度层的区间是 93..127（不是空的）', () => {
    const { regions } = adapt('electric_clean');
    const loud = regions.filter((r) => r.velocityLow === 93);

    expect(loud.length).toBeGreaterThan(0);
    for (const region of loud) {
      expect(region.velocityHigh).toBe(127);
    }
  });

  it('电吉他的 key=72 组不会劫持整个键盘', () => {
    const { regions } = adapt('electric_clean');
    const group = regions.filter((r) => r.rootKey === 72);

    expect(group.length).toBe(4); // 4 个轮询变体
    for (const region of group) {
      expect(region.keyLow).toBe(72);
      expect(region.keyHigh).toBe(72);
    }
  });

  it('西班牙吉他的多键区间使用 pitch_keycenter 作为根音', () => {
    const { regions } = adapt('nylon_classical');
    const g2 = regions.find((r) => r.keyLow === 42 && r.keyHigh === 43);

    expect(g2).toBeDefined();
    // 根音必须是 43（G2），绝不能取 keyLow=42
    expect(g2?.rootKey).toBe(43);
  });

  it('钢弦吉他的 key= 区域根音等于该键', () => {
    const { regions } = adapt('steel_acoustic');
    const hv41 = regions.find((r) => r.sampleRelPath.endsWith('HV_41.wav'));

    expect(hv41?.rootKey).toBe(41);
    expect(hv41?.keyLow).toBe(41);
    expect(hv41?.keyHigh).toBe(41);
  });

  it('钢弦吉他的覆盖范围是 MIDI 39..85', () => {
    const { regions } = adapt('steel_acoustic');
    const low = Math.min(...regions.map((r) => r.keyLow));
    const high = Math.max(...regions.map((r) => r.keyHigh));

    expect(low).toBe(39);
    expect(high).toBe(85);
  });

  it('采样路径中的空格被编码，+ 保持字面量', () => {
    const { regions } = adapt('electric_clean');
    const url = regions[0].sampleUrl;

    expect(url).toContain('%20'); // 目录名与文件名里的空格
    expect(url).toContain('+'); // path 中的 '+' 是合法字符，编码成 %2B 反而会 404
    expect(url).not.toContain('%2B');
  });
});
