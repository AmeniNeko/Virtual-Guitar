/**
 * SampleRegion.ts — 规范化后的采样区域
 *
 * 这是 SFZ 与播放引擎之间唯一的中间表示。
 * 播放引擎永远不接触原始 SFZ 文本。
 */

import type { InstrumentId } from './types';

export type LoopMode = 'no_loop' | 'loop_continuous' | 'loop_sustain' | 'one_shot';

export interface SampleRegion {
  /** `${instrument}#${index}` */
  id: string;
  instrument: InstrumentId;

  /** SFZ 中的原始相对路径，仅用于日志 */
  sampleRelPath: string;
  /** 解析后的绝对 URL —— 也是 SampleCache 的键 */
  sampleUrl: string;

  /** 覆盖的 MIDI 音高区间（含端点） */
  keyLow: number;
  keyHigh: number;
  /** 采样原始音高。永远来自 pitch_keycenter，绝不取 keyLow。 */
  rootKey: number;

  /** 覆盖的力度区间（含端点，1..127） */
  velocityLow: number;
  velocityHigh: number;

  /** 线性增益（已从 volume= 的 dB 转换） */
  gain: number;
  /** 半音移调 */
  transpose: number;
  /** 音分微调 */
  tune: number;

  /** 采样起始帧 */
  offset: number;
  /** 采样结束帧，0 = 播放到结尾 */
  end: number;

  loopMode: LoopMode;
  loopStart: number;
  loopEnd: number;

  /** 包络释放时间（秒），来自 ampeg_release */
  release: number;

  /** 在轮询候选集中的序号（来自 lorand，或按出现顺序） */
  alternateIndex: number;

  /** 闷音采样标记（当前音源无专用闷音采样，保留供扩展） */
  muted: boolean;
}

/** 计算播放速率：目标音高相对采样根音的比例，含 transpose（半音）与 tune（音分）。 */
export function pitchRatio(region: SampleRegion, midiNote: number): number {
  const semitones = midiNote - region.rootKey + region.transpose;
  return Math.pow(2, semitones / 12 + region.tune / 1200);
}

/** 轮询候选集的分组键：同一键区间 + 同一力度区间的 region 互为替代。 */
export function alternateGroupKey(region: SampleRegion): string {
  return `${region.keyLow}:${region.keyHigh}:${region.velocityLow}:${region.velocityHigh}`;
}
