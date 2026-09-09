/**
 * KeyboardMapper.ts — 键盘到指板的映射
 *
 * 将电脑键盘按键映射到吉他指板位置。
 * 默认布局（3行×6键 = 18个位置，覆盖 6 弦 × 3 品）：
 *
 *   第1行(高音弦): Q W E R T Y  → 1弦 0-5品
 *   第2行:        A S D F G H  → 2弦 0-5品
 *   第3行:        Z X C V B N  → 3弦 0-5品
 *   第4行(低音弦): 1 2 3 4 5 6  → 4-6弦 0-5品
 *
 * 支持 octave shift（+/- 12 半音）。
 */

import { getTuningById, getFretMidi } from '../Music/Tuning';
import { midiToNoteName, midiToOctave, midiToFrequency, type NoteName } from '../Music/Note';

/** 键盘映射条目 */
export interface KeyMapping {
  /** 键盘按键（小写） */
  key: string;
  /** 弦索引 (0=6弦, 5=1弦) */
  stringIdx: number;
  /** 品数 */
  fret: number;
  /** 显示标签 */
  label: string;
}

/** 键盘演奏结果 */
export interface KeyboardNote {
  key: string;
  stringIdx: number;
  fret: number;
  noteName: NoteName;
  octave: number;
  midi: number;
  frequency: number;
}

/** 默认键盘映射 */
const DEFAULT_MAP: KeyMapping[] = [
  // 第1行 → 1弦 (高音E)
  { key: 'q', stringIdx: 5, fret: 0, label: 'Q' },
  { key: 'w', stringIdx: 5, fret: 1, label: 'W' },
  { key: 'e', stringIdx: 5, fret: 2, label: 'E' },
  { key: 'r', stringIdx: 5, fret: 3, label: 'R' },
  { key: 't', stringIdx: 5, fret: 4, label: 'T' },
  { key: 'y', stringIdx: 5, fret: 5, label: 'Y' },

  // 第2行 → 2弦 (B)
  { key: 'a', stringIdx: 4, fret: 0, label: 'A' },
  { key: 's', stringIdx: 4, fret: 1, label: 'S' },
  { key: 'd', stringIdx: 4, fret: 2, label: 'D' },
  { key: 'f', stringIdx: 4, fret: 3, label: 'F' },
  { key: 'g', stringIdx: 4, fret: 4, label: 'G' },
  { key: 'h', stringIdx: 4, fret: 5, label: 'H' },

  // 第3行 → 3弦 (G)
  { key: 'z', stringIdx: 3, fret: 0, label: 'Z' },
  { key: 'x', stringIdx: 3, fret: 1, label: 'X' },
  { key: 'c', stringIdx: 3, fret: 2, label: 'C' },
  { key: 'v', stringIdx: 3, fret: 3, label: 'V' },
  { key: 'b', stringIdx: 3, fret: 4, label: 'B' },
  { key: 'n', stringIdx: 3, fret: 5, label: 'N' },

  // 数字行 → 4-6弦
  { key: '1', stringIdx: 2, fret: 0, label: '1' },
  { key: '2', stringIdx: 2, fret: 1, label: '2' },
  { key: '3', stringIdx: 2, fret: 2, label: '3' },
  { key: '4', stringIdx: 2, fret: 3, label: '4' },
  { key: '5', stringIdx: 2, fret: 4, label: '5' },
  { key: '6', stringIdx: 2, fret: 5, label: '6' },

  { key: '7', stringIdx: 1, fret: 0, label: '7' },
  { key: '8', stringIdx: 1, fret: 1, label: '8' },
  { key: '9', stringIdx: 1, fret: 2, label: '9' },
  { key: '0', stringIdx: 1, fret: 3, label: '0' },

  { key: '-', stringIdx: 0, fret: 0, label: '-' },
  { key: '=', stringIdx: 0, fret: 1, label: '=' },
];

class KeyboardMapperClass {
  private mappings: Map<string, KeyMapping> = new Map();
  private tuningId: string = 'standard';
  private capo: number = 0;
  private octaveShift: number = 0;

  constructor() {
    this.loadMap(DEFAULT_MAP);
  }

  /** 加载映射表 */
  private loadMap(map: KeyMapping[]): void {
    this.mappings.clear();
    for (const m of map) {
      this.mappings.set(m.key, m);
    }
  }

  /** 更新调弦（改变实际音高） */
  setTuning(tuningId: string): void {
    this.tuningId = tuningId;
  }

  /** 更新 Capo */
  setCapo(capo: number): void {
    this.capo = capo;
  }

  /** 设置八度偏移 (-2 ~ +2) */
  setOctaveShift(shift: number): void {
    this.octaveShift = Math.max(-2, Math.min(2, shift));
  }

  /** 获取八度偏移 */
  getOctaveShift(): number {
    return this.octaveShift;
  }

  /** 根据按键查找映射并计算音符 */
  resolveKey(key: string): KeyboardNote | null {
    const mapping = this.mappings.get(key.toLowerCase());
    if (!mapping) return null;

    const tuning = getTuningById(this.tuningId);
    const baseMidi = tuning.strings[mapping.stringIdx];
    const midi = getFretMidi(baseMidi, mapping.fret, this.capo) + this.octaveShift * 12;

    return {
      key: mapping.key,
      stringIdx: mapping.stringIdx,
      fret: mapping.fret,
      noteName: midiToNoteName(midi),
      octave: midiToOctave(midi),
      midi,
      frequency: midiToFrequency(midi),
    };
  }

  /** 获取所有映射（用于 UI 显示） */
  getAllMappings(): KeyMapping[] {
    return Array.from(this.mappings.values());
  }

  /** 获取某个位置对应的按键（反向查找） */
  getKeyForPosition(stringIdx: number, fret: number): string | null {
    for (const [, mapping] of this.mappings) {
      if (mapping.stringIdx === stringIdx && mapping.fret === fret) {
        return mapping.label;
      }
    }
    return null;
  }
}

/** 全局单例 */
export const KeyboardMapper = new KeyboardMapperClass();
