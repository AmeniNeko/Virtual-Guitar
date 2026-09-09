/**
 * scales.ts — 音阶数据库
 *
 * 定义所有音阶类型的详细数据。
 */

import type { NoteName } from '../Music/Note';
import { noteToIndex, indexToNote } from '../Music/Note';
import { SCALE_TYPES, type ScaleType } from '../Music/Scale';

/** 音阶定义 */
export interface ScaleDefinition {
  /** 音阶类型引用 */
  type: ScaleType;
  /** 音程标签 */
  intervalLabels: string[];
}

/** 间隔名称映射（半音 → 显示名） */
const INTERVAL_NAMES: Record<number, string> = {
  0: 'R',
  1: 'b2',
  2: '2',
  3: 'b3',
  4: '3',
  5: '4',
  6: '#4/b5',
  7: '5',
  8: '#5/b6',
  9: '6',
  10: 'b7',
  11: '7',
};

/** 构建音阶数据库 */
function buildScaleDatabase(): ScaleDefinition[] {
  return SCALE_TYPES.map((type) => ({
    type,
    intervalLabels: type.intervals.map((i) => INTERVAL_NAMES[i] ?? `${i}st`),
  }));
}

/** 完整音阶数据库 */
export const SCALE_DATABASE: ScaleDefinition[] = buildScaleDatabase();

/** 计算音阶的构成音名称 */
export function getScaleNoteNames(root: NoteName, type: ScaleType): NoteName[] {
  const rootIdx = noteToIndex(root);
  return type.intervals.map((interval) => indexToNote(rootIdx + interval));
}

/** 计算音阶的音程标签（相对于根音） */
export function getScaleIntervalLabels(type: ScaleType): string[] {
  return type.intervals.map((i) => INTERVAL_NAMES[i] ?? `${i}st`);
}
