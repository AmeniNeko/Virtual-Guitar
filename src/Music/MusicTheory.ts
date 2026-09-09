/**
 * MusicTheory.ts — 音乐理论统一入口
 *
 * 集中 re-export 所有音乐模型，方便其他模块引用。
 */

export {
  NOTE_NAMES,
  type NoteName,
  noteToIndex,
  indexToNote,
  midiToNoteName,
  midiToOctave,
  noteToMidi,
  midiToFrequency,
  type Note,
  createNote,
  formatNote,
} from './Note';

export {
  type TuningDefinition,
  TUNINGS,
  getTuningById,
  getFretMidi,
} from './Tuning';

export {
  type ChordType,
  CHORD_TYPES,
  type ChordDefinition,
  getChordNotes,
  getAllChords,
  findChord,
  formatChordName,
} from './Chord';

export {
  type ScaleType,
  SCALE_TYPES,
  getScaleSemitones,
  getScaleNotes,
  isInScale,
  ALL_ROOTS,
} from './Scale';

export {
  type FretPosition,
  type GuitarState,
  FRET_COUNT_OPTIONS,
  SINGLE_DOT_FRETS,
  DOUBLE_DOT_FRETS,
  buildFretPositions,
  findNearestPosition,
} from './GuitarState';

export {
  type ChordFingering,
  CHORD_DATABASE,
  findChordFingering,
  getChordNoteNames,
} from '../data/chords';

export {
  type ScaleDefinition,
  SCALE_DATABASE,
  getScaleNoteNames,
  getScaleIntervalLabels,
} from '../data/scales';
