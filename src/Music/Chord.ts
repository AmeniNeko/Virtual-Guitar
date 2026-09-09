/**
 * Chord.ts — 和弦模型
 *
 * 定义和弦类型、和弦构成音计算、和弦指法数据。
 */

import { type NoteName, NOTE_NAMES, noteToIndex, indexToNote } from './Note';

/** 和弦类型定义 */
export interface ChordType {
  id: string;
  name: string;
  /** 相对于根音的半音偏移 */
  intervals: number[];
}

/** 预设和弦类型 */
export const CHORD_TYPES: ChordType[] = [
  { id: 'major',  name: '',    intervals: [0, 4, 7] },
  { id: 'minor',  name: 'm',   intervals: [0, 3, 7] },
  { id: '7',      name: '7',   intervals: [0, 4, 7, 10] },
  { id: 'maj7',   name: 'maj7', intervals: [0, 4, 7, 11] },
  { id: 'm7',     name: 'm7',  intervals: [0, 3, 7, 10] },
  { id: 'sus2',   name: 'sus2', intervals: [0, 2, 7] },
  { id: 'sus4',   name: 'sus4', intervals: [0, 5, 7] },
  { id: 'add9',   name: 'add9', intervals: [0, 4, 7, 14] },
  { id: 'dim',    name: 'dim',  intervals: [0, 3, 6] },
  { id: 'aug',    name: 'aug',  intervals: [0, 4, 8] },
];

/** 和弦定义（根音 + 类型 + 指法） */
export interface ChordDefinition {
  root: NoteName;
  type: ChordType;
  /** 指法：索引 0=6弦，值为品数。null = 不弹。-1 = 静音。 */
  frets: (number | null)[];
  /** 指法编号（0=空弦，1-4=手指），null=不弹 */
  fingers: (number | null)[];
  /** 横按品数，0=无横按 */
  barre: number;
}

/** 计算和弦的构成音 */
export function getChordNotes(root: NoteName, type: ChordType): NoteName[] {
  const rootIdx = noteToIndex(root);
  return type.intervals.map((interval) => indexToNote(rootIdx + interval));
}

/** 生成所有根音 × 和弦类型的组合 */
export function getAllChords(): ChordDefinition[] {
  const commonFrets: Record<string, (number | null)[]> = {
    'C':    [3, 2, 0, 1, 0, 0],
    'Cm':   [3, 1, 0, 1, 3, 3],
    'D':    [null, null, 0, 2, 3, 2],
    'Dm':   [null, null, 0, 2, 3, 1],
    'E':    [0, 2, 2, 1, 0, 0],
    'Em':   [0, 2, 2, 0, 0, 0],
    'F':    [1, 1, 2, 3, 3, 1],
    'Fm':   [1, 3, 3, 1, 1, 1],
    'G':    [3, 2, 0, 0, 0, 3],
    'Gm':   [3, 5, 5, 3, 3, 3],
    'A':    [null, 0, 2, 2, 2, 0],
    'Am':   [null, 0, 2, 2, 1, 0],
    'B':    [null, 2, 4, 4, 4, 2],
    'Bm':   [null, 2, 4, 4, 3, 2],
  };

  const commonFingers: Record<string, (number | null)[]> = {
    'C':    [3, 2, 0, 1, 0, 0],
    'Cm':   [3, 1, 0, 1, 3, 4],
    'D':    [null, null, 0, 1, 3, 2],
    'Dm':   [null, null, 0, 2, 3, 1],
    'E':    [0, 2, 3, 1, 0, 0],
    'Em':   [0, 2, 3, 0, 0, 0],
    'F':    [1, 1, 2, 3, 4, 1],
    'Fm':   [1, 3, 4, 1, 1, 1],
    'G':    [2, 1, 0, 0, 0, 3],
    'Gm':   [1, 3, 4, 1, 1, 1],
    'A':    [null, 0, 1, 2, 3, 0],
    'Am':   [null, 0, 2, 3, 1, 0],
    'B':    [null, 1, 2, 3, 4, 1],
    'Bm':   [null, 1, 3, 4, 2, 1],
  };

  const barres: Record<string, number> = {
    'F': 1, 'Fm': 1, 'Gm': 3, 'B': 2, 'Bm': 2, 'Cm': 3,
  };

  const chords: ChordDefinition[] = [];

  for (const root of NOTE_NAMES) {
    for (const type of CHORD_TYPES) {
      const key = root;
      const frets = commonFrets[key] ?? [null, null, 0, 2, 3, 2];
      const fingers = commonFingers[key] ?? [null, null, 0, 1, 3, 2];
      const barre = barres[key] ?? 0;

      chords.push({
        root,
        type,
        frets: [...frets],
        fingers: [...fingers],
        barre,
      });
    }
  }

  return chords;
}

/** 快速查找：根音+类型ID → 和弦定义 */
const _allChords = getAllChords();
const _chordMap = new Map<string, ChordDefinition>();
_allChords.forEach((c) => _chordMap.set(`${c.root}-${c.type.id}`, c));

export function findChord(root: NoteName, typeId: string): ChordDefinition | undefined {
  return _chordMap.get(`${root}-${typeId}`);
}

/** 生成显示用的和弦名称，如 "Cm7" */
export function formatChordName(root: NoteName, type: ChordType): string {
  return `${root}${type.name}`;
}
