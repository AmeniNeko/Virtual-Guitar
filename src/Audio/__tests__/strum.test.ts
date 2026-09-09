/**
 * strum.test.ts — 扫弦时序与人性化
 *
 * 对应规范 §23/§24/§25：下扫 6→1、上扫 1→6、间隔可参数化、抖动有界且可复现。
 */

import { describe, expect, it } from 'vitest';

import { orderForStrum, planStrum } from '../Strum';
import { mulberry32 } from '../random';
import type { StrumEvent } from '../types';

/** 标准调弦空弦音，索引 0 = 6 弦 */
const OPEN_STRINGS = [
  { string: 0, fret: 0, midiNote: 40 },
  { string: 1, fret: 0, midiNote: 45 },
  { string: 2, fret: 0, midiNote: 50 },
  { string: 3, fret: 0, midiNote: 55 },
  { string: 4, fret: 0, midiNote: 59 },
  { string: 5, fret: 0, midiNote: 64 },
];

function makeEvent(direction: 'down' | 'up'): StrumEvent {
  return { direction, notes: OPEN_STRINGS, velocity: 100 };
}

describe('扫弦方向', () => {
  it('下扫按 6 弦 → 1 弦', () => {
    expect(orderForStrum('down', OPEN_STRINGS).map((n) => n.string)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('上扫按 1 弦 → 6 弦', () => {
    expect(orderForStrum('up', OPEN_STRINGS).map((n) => n.string)).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it('不修改传入的数组', () => {
    const original = [...OPEN_STRINGS];
    orderForStrum('up', OPEN_STRINGS);
    expect(OPEN_STRINGS).toEqual(original);
  });
});

describe('扫弦时序', () => {
  it('每根弦间隔等于给定 interval', () => {
    const plan = planStrum(makeEvent('down'), {
      start: 10,
      interval: 0.012,
      humanize: false,
      rng: mulberry32(1),
    });

    expect(plan).toHaveLength(6);
    plan.forEach((item, index) => {
      expect(item.when).toBeCloseTo(10 + index * 0.012, 9);
    });
  });

  it('六根弦总跨度 = 5 × interval', () => {
    const plan = planStrum(makeEvent('down'), {
      start: 0,
      interval: 0.02,
      humanize: false,
      rng: mulberry32(1),
    });

    expect(plan[5].when - plan[0].when).toBeCloseTo(0.1, 9);
  });

  it('关闭人性化时力度与输入完全一致', () => {
    const plan = planStrum(makeEvent('down'), {
      start: 0,
      interval: 0.01,
      humanize: false,
      rng: mulberry32(1),
    });

    for (const item of plan) expect(item.velocity).toBe(100);
  });

  it('上扫的时间顺序与弦序一致', () => {
    const plan = planStrum(makeEvent('up'), {
      start: 0,
      interval: 0.01,
      humanize: false,
      rng: mulberry32(1),
    });

    expect(plan.map((p) => p.string)).toEqual([5, 4, 3, 2, 1, 0]);
    expect(plan[0].when).toBeLessThan(plan[5].when);
  });
});

describe('人性化', () => {
  it('时序抖动不超过 ±3ms，力度变化不超过 ±8%', () => {
    const plan = planStrum(makeEvent('down'), {
      start: 0,
      interval: 0.01,
      humanize: true,
      rng: mulberry32(42),
    });

    plan.forEach((item, index) => {
      const nominal = index * 0.01;
      expect(Math.abs(item.when - nominal)).toBeLessThanOrEqual(0.003 + 1e-9);
      expect(item.velocity).toBeGreaterThanOrEqual(92 - 1e-6);
      expect(item.velocity).toBeLessThanOrEqual(108 + 1e-6);
    });
  });

  it('相同种子产生相同结果（可复现）', () => {
    const options = { start: 1, interval: 0.015, humanize: true };
    const a = planStrum(makeEvent('down'), { ...options, rng: mulberry32(7) });
    const b = planStrum(makeEvent('down'), { ...options, rng: mulberry32(7) });

    expect(a).toEqual(b);
  });

  it('不同种子产生不同结果（确实是随机的）', () => {
    const options = { start: 1, interval: 0.015, humanize: true };
    const a = planStrum(makeEvent('down'), { ...options, rng: mulberry32(1) });
    const b = planStrum(makeEvent('down'), { ...options, rng: mulberry32(2) });

    expect(a).not.toEqual(b);
  });
});
