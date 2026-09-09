/**
 * Tuning.ts — 调弦模型
 *
 * 定义各种调弦方式。每种调弦指定 6 根弦（6弦→1弦）的 MIDI 编号。
 * Capo 和实际音高变化由外部根据此处的基础音高计算。
 */

import { noteToMidi } from './Note';

/** 调弦定义 */
export interface TuningDefinition {
  id: string;
  name: string;
  /** 6 根弦的 MIDI 编号，索引 0 = 6弦（最粗），索引 5 = 1弦（最细） */
  strings: [number, number, number, number, number, number];
}

/** 预设调弦 */
export const TUNINGS: TuningDefinition[] = [
  {
    id: 'standard',
    name: 'Standard (EADGBE)',
    strings: [
      noteToMidi('E', 2),  // 6弦 E2 = 40
      noteToMidi('A', 2),  // 5弦 A2 = 45
      noteToMidi('D', 3),  // 4弦 D3 = 50
      noteToMidi('G', 3),  // 3弦 G3 = 55
      noteToMidi('B', 3),  // 2弦 B3 = 59
      noteToMidi('E', 4),  // 1弦 E4 = 64
    ],
  },
  {
    id: 'drop-d',
    name: 'Drop D (DADGBE)',
    strings: [
      noteToMidi('D', 2),  // 6弦 D2 = 38
      noteToMidi('A', 2),
      noteToMidi('D', 3),
      noteToMidi('G', 3),
      noteToMidi('B', 3),
      noteToMidi('E', 4),
    ],
  },
  {
    id: 'dadgad',
    name: 'DADGAD',
    strings: [
      noteToMidi('D', 2),
      noteToMidi('A', 2),
      noteToMidi('D', 3),
      noteToMidi('G', 3),
      noteToMidi('A', 3),
      noteToMidi('D', 4),
    ],
  },
  {
    id: 'open-g',
    name: 'Open G (DGDGBD)',
    strings: [
      noteToMidi('D', 2),
      noteToMidi('G', 2),
      noteToMidi('D', 3),
      noteToMidi('G', 3),
      noteToMidi('B', 3),
      noteToMidi('D', 4),
    ],
  },
  {
    id: 'open-d',
    name: 'Open D (DADF#AD)',
    strings: [
      noteToMidi('D', 2),
      noteToMidi('A', 2),
      noteToMidi('D', 3),
      noteToMidi('F#', 3),
      noteToMidi('A', 3),
      noteToMidi('D', 4),
    ],
  },
  {
    id: 'open-e',
    name: 'Open E (EBG#BEB)',
    strings: [
      noteToMidi('E', 2),
      noteToMidi('B', 2),
      noteToMidi('E', 3),
      noteToMidi('G#', 3),
      noteToMidi('B', 3),
      noteToMidi('E', 4),
    ],
  },
];

/** 根据 ID 查找调弦 */
export function getTuningById(id: string): TuningDefinition {
  return TUNINGS.find((t) => t.id === id) ?? TUNINGS[0];
}

/**
 * 获取指板上某一格的实际 MIDI 编号
 * @param baseMidi  该弦空弦的 MIDI 编号
 * @param fret      品数
 * @param capo      Capo 位置（0 = 无 Capo）
 * @returns 实际 MIDI 编号
 */
export function getFretMidi(baseMidi: number, fret: number, capo: number): number {
  return baseMidi + fret + capo;
}
