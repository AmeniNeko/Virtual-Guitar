/**
 * index.ts — Audio Engine 公共入口
 *
 * UI 只应该从这里导入。
 */

export { AudioEngine, normalizeInstrumentId } from './AudioEngine';
export type { PlayNoteParams, PlayChordOptions } from './AudioEngine';

export {
  INSTRUMENT_IDS,
  isInstrumentId,
  LEGACY_INSTRUMENT_IDS,
  type AudioEngineState,
  type AudioStats,
  type InstrumentId,
  type NoteOffEvent,
  type NoteOnEvent,
  type PluckEvent,
  type StrumDirection,
  type StrumEvent,
  type StrumOptions,
  type Velocity,
} from './types';

export { INSTRUMENT_PRESETS, getPreset, type InstrumentPreset } from './InstrumentPreset';
export { SamplePackManager, type PackStatus } from './SamplePackManager';

// 纯逻辑模块（测试与高级调试用）
export { parseSFZ, countRegions } from './sfz/SFZParser';
export { adaptSFZ, adaptSFZText, encodePath, resolveSampleUrl } from './InstrumentAdapter';
export { pitchRatio, type SampleRegion } from './SampleRegion';
export { clampVelocity } from './SampleResolver';
export { parseWavHeader, decodeWavToAudioBuffer, type WavInfo } from './WavMetadata';
export { AudioEngineTests, installDevTools, type SelfCheckResult } from './devtools';
export { planStrum, orderForStrum, type StrumPlanItem } from './Strum';
