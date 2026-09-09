/**
 * Note.ts — 音符核心模型
 *
 * 所有音符名称、半音编号、MIDI 编号的统一来源。
 * 其他模块通过此处的函数进行音符计算，避免重复逻辑。
 */

/** 12 个半音名称，索引即半音偏移量 */
export const NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F',
  'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const;

export type NoteName = (typeof NOTE_NAMES)[number];

/** 半音名称 → 索引（0-11） */
const NAME_TO_INDEX: Record<string, number> = {};
NOTE_NAMES.forEach((n, i) => { NAME_TO_INDEX[n] = i; });

export function noteToIndex(name: NoteName): number {
  return NAME_TO_INDEX[name];
}

/** 索引 → 半音名称 */
export function indexToNote(idx: number): NoteName {
  return NOTE_NAMES[((idx % 12) + 12) % 12];
}

/** MIDI 编号 → 音符名称 */
export function midiToNoteName(midi: number): NoteName {
  return indexToNote(midi % 12);
}

/** MIDI 编号 → 八度 */
export function midiToOctave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

/** 音符名称 + 八度 → MIDI 编号 */
export function noteToMidi(name: NoteName, octave: number): number {
  return (octave + 1) * 12 + noteToIndex(name);
}

/** MIDI 编号 → 频率 (Hz) — 唯一的频率计算函数 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** 简化的 Note 数据结构 */
export interface Note {
  name: NoteName;
  octave: number;
  midi: number;
  frequency: number;
}

/** 从 MIDI 编号构建完整 Note 对象 */
export function createNote(midi: number): Note {
  return {
    name: midiToNoteName(midi),
    octave: midiToOctave(midi),
    midi,
    frequency: midiToFrequency(midi),
  };
}

/** 格式化音符为显示用字符串，如 "C4" */
export function formatNote(note: Note): string {
  return `${note.name}${note.octave}`;
}
