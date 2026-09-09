/**
 * Scale.ts — 音阶模型
 *
 * 定义音阶类型、音阶构成音计算。
 */

import { type NoteName, noteToIndex, indexToNote, NOTE_NAMES } from './Note';

/** 音阶类型定义 */
export interface ScaleType {
  id: string;
  name: string;
  /** 相对于根音的半音偏移序列 */
  intervals: number[];
}

/** 预设音阶 */
export const SCALE_TYPES: ScaleType[] = [
  {
    id: 'major',
    name: 'Major',
    intervals: [0, 2, 4, 5, 7, 9, 11],
  },
  {
    id: 'natural-minor',
    name: 'Natural Minor',
    intervals: [0, 2, 3, 5, 7, 8, 10],
  },
  {
    id: 'major-pentatonic',
    name: 'Major Pentatonic',
    intervals: [0, 2, 4, 7, 9],
  },
  {
    id: 'minor-pentatonic',
    name: 'Minor Pentatonic',
    intervals: [0, 3, 5, 7, 10],
  },
  {
    id: 'blues',
    name: 'Blues',
    intervals: [0, 3, 5, 6, 7, 10],
  },
  {
    id: 'dorian',
    name: 'Dorian',
    intervals: [0, 2, 3, 5, 7, 9, 10],
  },
  {
    id: 'phrygian',
    name: 'Phrygian',
    intervals: [0, 1, 3, 5, 7, 8, 10],
  },
  {
    id: 'lydian',
    name: 'Lydian',
    intervals: [0, 2, 4, 6, 7, 9, 11],
  },
  {
    id: 'mixolydian',
    name: 'Mixolydian',
    intervals: [0, 2, 4, 5, 7, 9, 10],
  },
];

/** 计算音阶的构成音（半音索引，0-11） */
export function getScaleSemitones(root: NoteName, type: ScaleType): number[] {
  const rootIdx = noteToIndex(root);
  return type.intervals.map((interval) => (rootIdx + interval) % 12);
}

/** 计算音阶的构成音名称 */
export function getScaleNotes(root: NoteName, type: ScaleType): NoteName[] {
  return getScaleSemitones(root, type).map(indexToNote);
}

/** 判断某个半音（0-11）是否在给定音阶中 */
export function isInScale(semitone: number, root: NoteName, type: ScaleType): boolean {
  const scaleSet = new Set(getScaleSemitones(root, type));
  return scaleSet.has(((semitone % 12) + 12) % 12);
}

/** 所有 12 个根音 */
export const ALL_ROOTS: NoteName[] = [...NOTE_NAMES];
