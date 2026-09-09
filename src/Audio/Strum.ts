/**
 * Strum.ts — 扫弦排程（纯函数，便于测试）
 *
 * UI 只决定"什么时候扫、扫哪些弦"，具体每根弦的触发时刻由这里计算，
 * 再由 AudioEngine 在音频时钟上排程。
 *
 * 下扫：6 弦 → 1 弦（string 索引 0 → 5）
 * 上扫：1 弦 → 6 弦（string 索引 5 → 0）
 */

import type { StrumDirection, StrumEvent } from './types';

export interface StrumPlanItem {
  midiNote: number;
  string: number;
  fret: number;
  velocity: number;
  /** 绝对 AudioContext 时间（秒） */
  when: number;
}

export interface StrumPlanOptions {
  /** 第一根弦的绝对时间 */
  start: number;
  /** 相邻弦间隔（秒） */
  interval: number;
  humanize: boolean;
  /** 返回 [0,1) 的伪随机源 */
  rng: () => number;
}

/** 按扫弦方向排序：下扫 6→1，上扫 1→6。 */
export function orderForStrum<T extends { string: number }>(
  direction: StrumDirection,
  notes: T[],
): T[] {
  const ascending = [...notes].sort((a, b) => a.string - b.string);
  return direction === 'down' ? ascending : ascending.reverse();
}

/** 生成每根弦的触发时刻与力度。 */
export function planStrum(event: StrumEvent, options: StrumPlanOptions): StrumPlanItem[] {
  const notes = event.notes ?? [];
  const ordered = orderForStrum(event.direction, notes);
  const baseVelocity = event.velocity ?? 100;

  return ordered.map((note, index) => {
    let when = options.start + index * options.interval;
    let velocity = baseVelocity;

    if (options.humanize) {
      // ±3ms 时序抖动 + ±8% 力度变化 —— 刚好打破机械感，又不会听起来是错的
      when += (options.rng() - 0.5) * 0.006;
      velocity = Math.max(1, Math.min(127, baseVelocity * (0.92 + options.rng() * 0.16)));
    }

    return {
      midiNote: note.midiNote,
      string: note.string,
      fret: note.fret,
      velocity,
      when,
    };
  });
}
