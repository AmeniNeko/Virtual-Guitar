/**
 * sampleResolver.test.ts — 采样解析：键区 / 力度层 / 轮询 / 覆盖缺口
 */

import { describe, expect, it } from 'vitest';

import { SampleDatabase } from '../SampleDatabase';
import { SampleResolver, clampVelocity } from '../SampleResolver';
import { pitchRatio, type SampleRegion } from '../SampleRegion';
import type { InstrumentId } from '../types';

const INSTRUMENT: InstrumentId = 'steel_acoustic';

function makeRegion(over: Partial<SampleRegion>): SampleRegion {
  return {
    id: 'region',
    instrument: INSTRUMENT,
    sampleRelPath: 'a.wav',
    sampleUrl: '/sounds/a.wav',
    keyLow: 0,
    keyHigh: 127,
    rootKey: 60,
    velocityLow: 1,
    velocityHigh: 127,
    gain: 1,
    transpose: 0,
    tune: 0,
    offset: 0,
    end: 0,
    loopMode: 'no_loop',
    loopStart: 0,
    loopEnd: 0,
    release: 0.3,
    alternateIndex: 0,
    muted: false,
    ...over,
  };
}

function makeResolver(regions: SampleRegion[]): SampleResolver {
  const db = new SampleDatabase();
  db.setRegions(INSTRUMENT, regions);
  return new SampleResolver(db);
}

describe('力度层选择', () => {
  const regions = [
    makeRegion({ id: 'soft', sampleUrl: '/soft.wav', keyLow: 60, keyHigh: 60, rootKey: 60, velocityLow: 1, velocityHigh: 40 }),
    makeRegion({ id: 'mid', sampleUrl: '/mid.wav', keyLow: 60, keyHigh: 60, rootKey: 60, velocityLow: 41, velocityHigh: 80 }),
    makeRegion({ id: 'loud', sampleUrl: '/loud.wav', keyLow: 60, keyHigh: 60, rootKey: 60, velocityLow: 81, velocityHigh: 127 }),
  ];

  it('严格按照 lovel/hivel 选择层', () => {
    const resolver = makeResolver(regions);

    expect(resolver.resolve(INSTRUMENT, 60, 20)?.region.id).toBe('soft');
    expect(resolver.resolve(INSTRUMENT, 60, 72)?.region.id).toBe('mid');
    expect(resolver.resolve(INSTRUMENT, 60, 100)?.region.id).toBe('loud');
  });

  it('力度落在所有层之外时退到最近的一层，而不是静音', () => {
    const only = [makeRegion({ id: 'mid', keyLow: 60, keyHigh: 60, rootKey: 60, velocityLow: 41, velocityHigh: 80 })];
    const resolver = makeResolver(only);

    expect(resolver.resolve(INSTRUMENT, 60, 5)?.region.id).toBe('mid');
    expect(resolver.resolve(INSTRUMENT, 60, 127)?.region.id).toBe('mid');
  });
});

describe('键区筛选', () => {
  it('只在覆盖该音高的 region 里选择', () => {
    const regions = [
      makeRegion({ id: 'a', keyLow: 60, keyHigh: 64, rootKey: 60 }),
      makeRegion({ id: 'b', keyLow: 65, keyHigh: 69, rootKey: 65 }),
    ];
    const resolver = makeResolver(regions);

    expect(resolver.resolve(INSTRUMENT, 62, 100)?.region.id).toBe('a');
    expect(resolver.resolve(INSTRUMENT, 67, 100)?.region.id).toBe('b');
  });

  it('覆盖缺口回退到最近的根音，并标记 substituted', () => {
    const regions = [makeRegion({ id: 'a', keyLow: 40, keyHigh: 44, rootKey: 42 })];
    const resolver = makeResolver(regions);

    const resolved = resolver.resolve(INSTRUMENT, 38, 100);
    expect(resolved?.region.id).toBe('a');
    expect(resolved?.substituted).toBe(true);
  });
});

describe('轮询（round robin）', () => {
  it('同一条件下的多个采样按确定性顺序轮换，不是随机', () => {
    const regions = [
      makeRegion({ id: 'rr1', sampleUrl: '/1.wav', keyLow: 60, keyHigh: 60, rootKey: 60, alternateIndex: 0 }),
      makeRegion({ id: 'rr2', sampleUrl: '/2.wav', keyLow: 60, keyHigh: 60, rootKey: 60, alternateIndex: 0.25 }),
      makeRegion({ id: 'rr3', sampleUrl: '/3.wav', keyLow: 60, keyHigh: 60, rootKey: 60, alternateIndex: 0.5 }),
    ];
    const resolver = makeResolver(regions);

    const order = [0, 1, 2, 3, 4, 5].map(
      () => resolver.resolve(INSTRUMENT, 60, 100)?.region.id,
    );

    expect(order).toEqual(['rr1', 'rr2', 'rr3', 'rr1', 'rr2', 'rr3']);
  });

  it('不同音高各自独立轮换', () => {
    const regions = [
      makeRegion({ id: 'c1', keyLow: 60, keyHigh: 60, rootKey: 60, alternateIndex: 0 }),
      makeRegion({ id: 'c2', keyLow: 60, keyHigh: 60, rootKey: 60, alternateIndex: 1 }),
      makeRegion({ id: 'd1', keyLow: 62, keyHigh: 62, rootKey: 62, alternateIndex: 0 }),
      makeRegion({ id: 'd2', keyLow: 62, keyHigh: 62, rootKey: 62, alternateIndex: 1 }),
    ];
    const resolver = makeResolver(regions);

    expect(resolver.resolve(INSTRUMENT, 60, 100)?.region.id).toBe('c1');
    expect(resolver.resolve(INSTRUMENT, 62, 100)?.region.id).toBe('d1');
    expect(resolver.resolve(INSTRUMENT, 60, 100)?.region.id).toBe('c2');
    expect(resolver.resolve(INSTRUMENT, 62, 100)?.region.id).toBe('d2');
  });
});

describe('音高计算', () => {
  it('根音等于目标音高时不移调', () => {
    expect(pitchRatio(makeRegion({ rootKey: 60 }), 60)).toBeCloseTo(1, 10);
  });

  it('采样比目标音高一个半音时向下移调', () => {
    // 西班牙吉他的 G2 采样（根音 43）覆盖 42，播放时必须降半音
    const ratio = pitchRatio(makeRegion({ rootKey: 43 }), 42);
    expect(ratio).toBeCloseTo(Math.pow(2, -1 / 12), 10);
  });

  it('transpose 按半音、tune 按音分计算', () => {
    const ratio = pitchRatio(makeRegion({ rootKey: 60, transpose: 12, tune: 100 }), 60);
    // 12 个半音（一个八度）+ 100 音分（一个半音）
    expect(ratio).toBeCloseTo(Math.pow(2, 13 / 12), 10);
  });

  it('resolve 返回的 ratio 与 region 一致', () => {
    const resolver = makeResolver([makeRegion({ keyLow: 60, keyHigh: 60, rootKey: 64 })]);
    expect(resolver.resolve(INSTRUMENT, 60, 100)?.ratio).toBeCloseTo(Math.pow(2, -4 / 12), 10);
  });
});

describe('力度归一化', () => {
  it('0–1 视为归一化值，>1 视为 MIDI 力度', () => {
    expect(clampVelocity(0.5)).toBe(64);
    expect(clampVelocity(100)).toBe(100);
  });

  it('下限为 1，避免 UI 滑杆拉到 0 时完全静音', () => {
    expect(clampVelocity(0)).toBe(1);
  });

  it('上限为 127', () => {
    expect(clampVelocity(999)).toBe(127);
  });
});
