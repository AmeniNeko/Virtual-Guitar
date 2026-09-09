/**
 * types.ts — Audio Engine 公共类型
 *
 * 这里定义 UI 与 Audio Engine 之间的唯一契约。
 * UI 只发送演奏事件，不接触 WAV / SFZ / AudioBuffer。
 */

/** 四个乐器预设的规范 ID */
export type InstrumentId =
  | 'steel_acoustic'
  | 'nylon_classical'
  | 'electric_clean'
  | 'electric_overdrive';

export const INSTRUMENT_IDS: readonly InstrumentId[] = [
  'steel_acoustic',
  'nylon_classical',
  'electric_clean',
  'electric_overdrive',
];

export function isInstrumentId(value: unknown): value is InstrumentId {
  return typeof value === 'string' && (INSTRUMENT_IDS as readonly string[]).includes(value);
}

/** 旧的（v0）乐器 ID → 规范 ID。用于 URL / localStorage 迁移。 */
export const LEGACY_INSTRUMENT_IDS: Record<string, InstrumentId> = {
  acoustic: 'steel_acoustic',
  nylon: 'nylon_classical',
  'clean-electric': 'electric_clean',
};

/** 音色加载状态。UI 自行决定如何展示。 */
export type AudioEngineState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * 力度约定：
 * - `<= 1`  视为归一化值 (0..1)，内部乘以 127
 * - `> 1`   视为 MIDI 力度 (1..127)
 * - 最终一律 clamp 到 1..127（0 会让音符静音，UI 滑杆最小值为 0）
 */
export type Velocity = number;

export interface PluckEvent {
  /** MIDI 音高 */
  midiNote: number;
  velocity?: Velocity;
  /** 弦索引：0 = 6 弦（最粗），5 = 1 弦（最细）。仅用于演奏行为，不改变音高映射。 */
  string?: number;
  /** 品位 */
  fret?: number;
  /** 绝对 AudioContext 时间（秒）。省略 = 立即。 */
  when?: number;
  /** 秒。设置后在 when + duration 处自动 noteOff。 */
  duration?: number;
  /** 闷音演奏 */
  muted?: boolean;
}

export interface NoteOnEvent {
  midiNote: number;
  velocity?: Velocity;
  string?: number;
  fret?: number;
  when?: number;
}

export interface NoteOffEvent {
  midiNote: number;
  /** 绝对 AudioContext 时间（秒）。省略 = 立即。 */
  when?: number;
}

export type StrumDirection = 'down' | 'up';

export interface StrumEvent {
  direction: StrumDirection;
  /** 参与扫弦的弦索引（0 = 6 弦）。省略 = 全部 6 根。 */
  strings?: number[];
  velocity?: Velocity;
  /** 相邻弦间隔（秒）。默认取引擎配置，clamp 到 5–30ms。 */
  interval?: number;
  /** 绝对 AudioContext 时间（秒）。省略 = 立即。 */
  when?: number;
  /** 每根弦的实际音高（由 UI 依据调弦/Capo 计算）。 */
  notes: { string: number; fret: number; midiNote: number }[];
}

/** `getStats()` 返回值 —— 供开发者调试，不驱动 UI 渲染。 */
export interface AudioStats {
  state: AudioEngineState;
  currentInstrument: InstrumentId;
  audioContextState: string;
  activeVoices: number;
  peakVoices: number;
  maxVoices: number;
  loadedSamples: number;
  cacheSize: number;
  cacheBytes: number;
  cacheBudgetBytes: number;
  cacheHitRate: number;
  cacheHits: number;
  cacheMisses: number;
  regions: number;
  lastError: string | null;
}

export interface StrumOptions {
  /** 默认扫弦间隔（秒） */
  interval?: number;
  /** 人性化：±1–5ms 时间抖动 + 轻微力度变化 */
  humanize?: boolean;
  /** 伪随机种子，保证测试可复现 */
  seed?: number;
}
