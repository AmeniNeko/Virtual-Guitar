/**
 * chords.ts — 和弦数据库
 *
 * 定义所有和弦的指法数据。
 * 每个和弦包含：名称、根音、类型、指法、横按信息。
 */

import type { NoteName } from '../Music/Note';
import { NOTE_NAMES, noteToIndex, indexToNote } from '../Music/Note';
import { CHORD_TYPES, type ChordType } from '../Music/Chord';

/** 和弦指法定义 */
export interface ChordFingering {
  /** 和弦显示名，如 "C", "Dm", "G7" */
  name: string;
  /** 根音 */
  root: NoteName;
  /** 和弦类型引用 */
  type: ChordType;
  /**
   * 指板指法：索引 0=6弦, 5=1弦
   * 值 = 品数, null = 不弹, -1 = 静音(mute)
   */
  frets: (number | null)[];
  /**
   * 手指编号：0=空弦, 1=食指, 2=中指, 3=无名指, 4=小指
   * null = 不弹
   */
  fingers: (number | null)[];
  /** 横按品数，0 = 无横按 */
  barre: number;
  /** 音程标签（从根音开始） */
  intervals: string[];
}

// ─── 指法数据 ────────────────────────────────────────

/** 常用和弦指法库（Open position） */
const FINGERINGS: Record<string, {
  frets: (number | null)[];
  fingers: (number | null)[];
  barre: number;
}> = {
  // Major
  'C':    { frets: [3, 2, 0, 1, 0, 0], fingers: [3, 2, 0, 1, 0, 0], barre: 0 },
  'D':    { frets: [null, null, 0, 2, 3, 2], fingers: [null, null, 0, 1, 3, 2], barre: 0 },
  'E':    { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], barre: 0 },
  'F':    { frets: [1, 1, 2, 3, 3, 1], fingers: [1, 1, 2, 3, 4, 1], barre: 1 },
  'G':    { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], barre: 0 },
  'A':    { frets: [null, 0, 2, 2, 2, 0], fingers: [null, 0, 1, 2, 3, 0], barre: 0 },
  'B':    { frets: [null, 2, 4, 4, 4, 2], fingers: [null, 1, 2, 3, 4, 1], barre: 2 },

  // Minor
  'Cm':   { frets: [3, 1, 0, 1, 3, 3], fingers: [3, 1, 0, 1, 3, 4], barre: 0 },
  'Dm':   { frets: [null, null, 0, 2, 3, 1], fingers: [null, null, 0, 2, 3, 1], barre: 0 },
  'Em':   { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], barre: 0 },
  'Fm':   { frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], barre: 1 },
  'Gm':   { frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1], barre: 3 },
  'Am':   { frets: [null, 0, 2, 2, 1, 0], fingers: [null, 0, 2, 3, 1, 0], barre: 0 },
  'Bm':   { frets: [null, 2, 4, 4, 3, 2], fingers: [null, 1, 3, 4, 2, 1], barre: 2 },

  // 7th
  'C7':   { frets: [3, 2, 3, 1, 0, 0], fingers: [3, 2, 4, 1, 0, 0], barre: 0 },
  'D7':   { frets: [null, null, 0, 2, 1, 2], fingers: [null, null, 0, 2, 1, 3], barre: 0 },
  'E7':   { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0], barre: 0 },
  'F7':   { frets: [1, 3, 1, 2, 1, 1], fingers: [1, 3, 1, 2, 1, 1], barre: 1 },
  'G7':   { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1], barre: 0 },
  'A7':   { frets: [null, 0, 2, 0, 2, 0], fingers: [null, 0, 1, 0, 2, 0], barre: 0 },
  'B7':   { frets: [null, 2, 1, 2, 0, 2], fingers: [null, 2, 1, 3, 0, 4], barre: 0 },

  // maj7
  'Cmaj7': { frets: [3, 2, 0, 0, 0, 0], fingers: [3, 2, 0, 0, 0, 0], barre: 0 },
  'Dmaj7': { frets: [null, null, 0, 2, 2, 2], fingers: [null, null, 0, 1, 1, 1], barre: 0 },
  'Emaj7': { frets: [0, 2, 1, 1, 0, 0], fingers: [0, 2, 1, 1, 0, 0], barre: 0 },
  'Fmaj7': { frets: [1, 3, 2, 2, 1, 0], fingers: [1, 3, 2, 2, 1, 0], barre: 0 },
  'Gmaj7': { frets: [3, 2, 0, 0, 0, 2], fingers: [2, 1, 0, 0, 0, 3], barre: 0 },
  'Amaj7': { frets: [null, 0, 2, 1, 2, 0], fingers: [null, 0, 2, 1, 3, 0], barre: 0 },
  'Bmaj7': { frets: [null, 2, 4, 3, 4, 2], fingers: [null, 1, 3, 2, 4, 1], barre: 2 },

  // m7
  'Cm7':  { frets: [3, 1, 3, 3, 3, 3], fingers: [2, 1, 3, 3, 3, 3], barre: 3 },
  'Dm7':  { frets: [null, null, 0, 2, 1, 1], fingers: [null, null, 0, 3, 1, 1], barre: 0 },
  'Em7':  { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0], barre: 0 },
  'Fm7':  { frets: [1, 3, 1, 1, 1, 1], fingers: [1, 3, 1, 1, 1, 1], barre: 1 },
  'Gm7':  { frets: [3, 5, 3, 3, 3, 3], fingers: [1, 3, 1, 1, 1, 1], barre: 3 },
  'Am7':  { frets: [null, 0, 2, 0, 1, 0], fingers: [null, 0, 2, 0, 1, 0], barre: 0 },
  'Bm7':  { frets: [null, 2, 0, 2, 0, 2], fingers: [null, 1, 0, 2, 0, 3], barre: 0 },

  // sus2
  'Csus2': { frets: [3, 0, 0, 3, 3, 0], fingers: [2, 0, 0, 3, 4, 0], barre: 0 },
  'Dsus2': { frets: [null, null, 0, 2, 3, 0], fingers: [null, null, 0, 1, 3, 0], barre: 0 },
  'Esus2': { frets: [0, 2, 4, 4, 0, 0], fingers: [0, 1, 3, 4, 0, 0], barre: 0 },
  'Fsus2': { frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], barre: 1 },
  'Gsus2': { frets: [3, 0, 0, 3, 3, 3], fingers: [2, 0, 0, 1, 1, 1], barre: 0 },
  'Asus2': { frets: [null, 0, 2, 2, 0, 0], fingers: [null, 0, 1, 2, 0, 0], barre: 0 },
  'Bsus2': { frets: [null, 2, 4, 4, 2, 2], fingers: [null, 1, 3, 4, 1, 1], barre: 2 },

  // sus4
  'Csus4': { frets: [3, 3, 0, 1, 1, 0], fingers: [2, 3, 0, 1, 1, 0], barre: 0 },
  'Dsus4': { frets: [null, null, 0, 2, 3, 3], fingers: [null, null, 0, 1, 2, 3], barre: 0 },
  'Esus4': { frets: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0], barre: 0 },
  'Fsus4': { frets: [1, 1, 3, 3, 1, 1], fingers: [1, 1, 3, 4, 1, 1], barre: 1 },
  'Gsus4': { frets: [3, 3, 0, 0, 1, 3], fingers: [2, 3, 0, 0, 1, 4], barre: 0 },
  'Asus4': { frets: [null, 0, 2, 2, 3, 0], fingers: [null, 0, 1, 2, 3, 0], barre: 0 },
  'Bsus4': { frets: [null, 2, 4, 4, 5, 2], fingers: [null, 1, 2, 3, 4, 1], barre: 2 },

  // add9
  'Cadd9':  { frets: [3, 2, 0, 3, 0, 0], fingers: [2, 1, 0, 3, 0, 0], barre: 0 },
  'Dadd9':  { frets: [null, null, 0, 2, 3, 0], fingers: [null, null, 0, 1, 3, 0], barre: 0 },
  'Eadd9':  { frets: [0, 2, 2, 1, 0, 2], fingers: [0, 2, 3, 1, 0, 4], barre: 0 },
  'Fadd9':  { frets: [1, 3, 3, 2, 1, 0], fingers: [1, 3, 4, 2, 1, 0], barre: 0 },
  'Gadd9':  { frets: [3, 2, 0, 3, 0, 3], fingers: [2, 1, 0, 3, 0, 4], barre: 0 },
  'Aadd9':  { frets: [null, 0, 2, 2, 2, 0], fingers: [null, 0, 1, 2, 3, 0], barre: 0 },
  'Badd9':  { frets: [null, 2, 4, 4, 4, 2], fingers: [null, 1, 2, 3, 4, 1], barre: 2 },

  // dim
  'Cdim':  { frets: [null, 3, 1, 2, 1, 2], fingers: [null, 3, 1, 2, 1, 4], barre: 0 },
  'Ddim':  { frets: [null, null, 0, 1, 3, 1], fingers: [null, null, 0, 1, 3, 1], barre: 0 },
  'Edim':  { frets: [0, 1, 2, 0, 2, 0], fingers: [0, 1, 3, 0, 4, 0], barre: 0 },
  'Fdim':  { frets: [1, 2, 3, 1, 3, 1], fingers: [1, 2, 3, 1, 4, 1], barre: 1 },
  'Gdim':  { frets: [3, 4, 5, 3, 5, 3], fingers: [1, 2, 3, 1, 4, 1], barre: 3 },
  'Adim':  { frets: [null, 0, 1, 2, 1, 2], fingers: [null, 0, 1, 3, 1, 4], barre: 0 },
  'Bdim':  { frets: [null, 2, 3, 4, 3, 4], fingers: [null, 1, 2, 3, 2, 4], barre: 0 },

  // aug
  'Caug':  { frets: [null, 3, 2, 1, 1, 0], fingers: [null, 3, 2, 1, 1, 0], barre: 0 },
  'Daug':  { frets: [null, null, 0, 3, 3, 2], fingers: [null, null, 0, 2, 3, 1], barre: 0 },
  'Eaug':  { frets: [0, 3, 2, 1, 1, 0], fingers: [0, 3, 2, 1, 1, 0], barre: 0 },
  'Faug':  { frets: [1, null, 2, 3, 3, 0], fingers: [1, null, 2, 3, 4, 0], barre: 0 },
  'Gaug':  { frets: [3, 2, 1, 0, 0, 3], fingers: [3, 2, 1, 0, 0, 4], barre: 0 },
  'Aaug':  { frets: [null, 0, 3, 2, 2, 0], fingers: [null, 0, 3, 1, 2, 0], barre: 0 },
  'Baug':  { frets: [null, 2, 1, 0, 0, 2], fingers: [null, 2, 1, 0, 0, 3], barre: 0 },
};

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
  12: '8',
  13: 'b9',
  14: '9',
  15: '#9',
  16: '3',
  17: '11',
  18: '#11',
  19: '5',
};

/** 获取和弦的音程标签 */
function getChordIntervals(type: ChordType): string[] {
  return type.intervals.map((i) => INTERVAL_NAMES[i] ?? `${i}st`);
}

// ─── 构建完整数据库 ──────────────────────────────────

/** 构建所有根音 × 类型的和弦数据库 */
function buildChordDatabase(): ChordFingering[] {
  const chords: ChordFingering[] = [];

  for (const root of NOTE_NAMES) {
    for (const type of CHORD_TYPES) {
      const key = root + (type.name || '');
      const fingering = FINGERINGS[key];

      const frets = fingering?.frets ?? [null, null, 0, 2, 3, 2];
      const fingers = fingering?.fingers ?? [null, null, 0, 1, 3, 2];
      const barre = fingering?.barre ?? 0;

      chords.push({
        name: `${root}${type.name}`,
        root,
        type,
        frets: [...frets],
        fingers: [...fingers],
        barre,
        intervals: getChordIntervals(type),
      });
    }
  }

  return chords;
}

/** 完整和弦数据库 */
export const CHORD_DATABASE: ChordFingering[] = buildChordDatabase();

/** 和弦查找 Map：key = "root-typeId" */
const _chordMap = new Map<string, ChordFingering>();
CHORD_DATABASE.forEach((c) => _chordMap.set(`${c.root}-${c.type.id}`, c));

/** 查找和弦 */
export function findChordFingering(root: NoteName, typeId: string): ChordFingering | undefined {
  return _chordMap.get(`${root}-${typeId}`);
}

/** 获取和弦的构成音名称 */
export function getChordNoteNames(root: NoteName, type: ChordType): string[] {
  const rootIdx = noteToIndex(root);
  return type.intervals.map((interval) => indexToNote(rootIdx + interval));
}
