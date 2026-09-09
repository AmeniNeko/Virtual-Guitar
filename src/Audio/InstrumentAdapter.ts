/**
 * InstrumentAdapter.ts — SFZ 文档 → 规范化 SampleRegion[]
 *
 * 承担所有乐器语义：
 * - key= 简写展开
 * - 根音解析（pitch_keycenter > key > 60）
 * - dB → 线性增益
 * - sample 相对路径 → 绝对 URL
 * - 非法区间过滤
 *
 * Audio Engine 内部不存在 "if 电吉他 / if 民谣吉他" 这类硬编码分支，
 * 差异全部通过这里的规范化结果表达。
 */

import { numOpcode, resolveOpcodes, type SFZDocument } from './sfz/SFZTypes';
import { parseSFZ } from './sfz/SFZParser';
import type { LoopMode, SampleRegion } from './SampleRegion';
import type { InstrumentId } from './types';

export interface AdaptOptions {
  instrument: InstrumentId;
  /** SFZ 所在目录（未编码的绝对路径，以 / 开头，以 / 结尾） */
  sfzBaseDir: string;
}

export interface AdaptResult {
  regions: SampleRegion[];
  warnings: string[];
}

/**
 * 逐段编码路径。
 *
 * 空格编码为 `%20`；`+` 保持字面量 —— 在 URL 的 path 中 `+` 就是加号本身
 * （只有 query string 才把它当空格）。编码成 `%2B` 会让部分静态服务器
 * （包括 Vite dev server）找不到文件。音源目录名同时包含空格与 `+`。
 */
export function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment).replace(/%2B/gi, '+'))
    .join('/');
}

/** 拼接目录与相对路径并编码，折叠重复斜杠。 */
export function resolveSampleUrl(baseDir: string, relPath: string): string {
  const joined = `${baseDir}/${relPath}`.replace(/\/{2,}/g, '/');
  return encodePath(joined);
}

const LOOP_MODES: Record<string, LoopMode> = {
  no_loop: 'no_loop',
  one_shot: 'one_shot',
  loop_continuous: 'loop_continuous',
  loop_sustain: 'loop_sustain',
};

function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/** 把一份已解析的 SFZ 文档转换成规范化 region。 */
export function adaptSFZ(doc: SFZDocument, options: AdaptOptions): AdaptResult {
  const { instrument, sfzBaseDir } = options;
  const warnings: string[] = [];
  const regions: SampleRegion[] = [];
  const defaultPath = doc.controls.get('default_path') ?? '';

  let index = 0;

  for (const group of doc.groups) {
    let orderInGroup = 0;
    for (const raw of group.regions) {
      const ops = resolveOpcodes(doc.globals, group.opcodes, raw.opcodes);

      const sample = ops.get('sample');
      if (!sample) {
        warnings.push(`Region at line ${raw.line} has no sample=; skipped`);
        continue;
      }

      // key= 是 lokey/hikey/pitch_keycenter 的简写。若不展开，
      // `<group> key=72` 会退化为 0..127 并劫持整个键盘。
      const keyShorthand = ops.has('key') ? numOpcode(ops, 'key', NaN) : NaN;
      const hasKey = Number.isFinite(keyShorthand);

      const keyLow = Math.round(ops.has('lokey') ? numOpcode(ops, 'lokey', 0) : hasKey ? keyShorthand : 0);
      const keyHigh = Math.round(ops.has('hikey') ? numOpcode(ops, 'hikey', 127) : hasKey ? keyShorthand : 127);
      const rootKey = Math.round(
        ops.has('pitch_keycenter')
          ? numOpcode(ops, 'pitch_keycenter', keyLow)
          : hasKey
            ? keyShorthand
            : 60,
      );

      const velocityLow = Math.round(Math.max(1, ops.has('lovel') ? numOpcode(ops, 'lovel', 1) : 1));
      const velocityHigh = Math.round(Math.min(127, ops.has('hivel') ? numOpcode(ops, 'hivel', 127) : 127));

      if (keyLow > keyHigh) {
        warnings.push(`Region at line ${raw.line}: lokey(${keyLow}) > hikey(${keyHigh}); skipped`);
        continue;
      }
      if (velocityLow > velocityHigh) {
        warnings.push(`Region at line ${raw.line}: lovel(${velocityLow}) > hivel(${velocityHigh}); skipped`);
        continue;
      }

      const loopModeRaw = (ops.get('loop_mode') ?? 'no_loop').toLowerCase();
      let loopMode: LoopMode = LOOP_MODES[loopModeRaw] ?? 'no_loop';
      if (loopModeRaw && !LOOP_MODES[loopModeRaw]) {
        warnings.push(`Region at line ${raw.line}: unknown loop_mode="${loopModeRaw}"; using no_loop`);
      }

      let loopStart = Math.max(0, Math.round(numOpcode(ops, 'loop_start', 0)));
      let loopEnd = Math.max(0, Math.round(numOpcode(ops, 'loop_end', 0)));
      if (loopMode !== 'no_loop' && loopEnd > 0 && loopEnd <= loopStart) {
        warnings.push(`Region at line ${raw.line}: loop_end <= loop_start; disabling loop`);
        loopMode = 'no_loop';
        loopStart = 0;
        loopEnd = 0;
      }

      const relPath = defaultPath ? `${defaultPath}/${sample}` : sample;
      const lorand = numOpcode(ops, 'lorand', NaN);

      regions.push({
        id: `${instrument}#${index++}`,
        instrument,
        sampleRelPath: relPath,
        sampleUrl: resolveSampleUrl(sfzBaseDir, relPath),
        keyLow,
        keyHigh,
        rootKey,
        velocityLow,
        velocityHigh,
        gain: dbToGain(numOpcode(ops, 'volume', 0)),
        transpose: numOpcode(ops, 'transpose', 0),
        tune: numOpcode(ops, 'tune', 0),
        offset: Math.max(0, Math.round(numOpcode(ops, 'offset', 0))),
        end: Math.round(numOpcode(ops, 'end', 0)),
        loopMode,
        loopStart,
        loopEnd,
        release: Math.max(0.01, numOpcode(ops, 'ampeg_release', 0.3)),
        alternateIndex: Number.isFinite(lorand) ? lorand : orderInGroup,
        muted: /(^|[_\W])mute/i.test(sample),
      });
      orderInGroup++;
    }
  }

  return { regions, warnings };
}

/** 便捷入口：文本 → 规范化 region。 */
export function adaptSFZText(text: string, options: AdaptOptions): AdaptResult {
  const doc = parseSFZ(text);
  const result = adaptSFZ(doc, options);
  return { regions: result.regions, warnings: [...doc.warnings, ...result.warnings] };
}
