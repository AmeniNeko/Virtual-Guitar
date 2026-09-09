/**
 * AudioEngine.ts — 采样吉他音频引擎（外观层）
 *
 * 对 UI 只暴露演奏事件，绝不暴露 WAV / SFZ / AudioBuffer：
 *
 *   UI ──Pluck / Strum / NoteOn / NoteOff──▶ AudioEngine
 *                                                ├── SFZ → SampleRegion
 *                                                ├── SampleCache（按需解码）
 *                                                ├── SampleResolver（键区/力度/轮询）
 *                                                ├── VoiceManager（32 声部）
 *                                                └── EffectChain → 主输出 → 限幅
 *
 * 兼容层：playNote / playChord / setInstrument 仍然可用，
 * 现有 UI 调用点无需改动即可工作。
 */

import { EffectChain } from './EffectChain';
import { getPreset, INSTRUMENT_PRESETS } from './InstrumentPreset';
import { InstrumentManager } from './InstrumentManager';
import { logger } from './Logger';
import { DEFAULT_CACHE_BUDGET_BYTES, SampleCache, type SampleCacheStats } from './SampleCache';
import { SampleDatabase } from './SampleDatabase';
import { SampleResolver, clampVelocity } from './SampleResolver';
import { SamplePackManager } from './SamplePackManager';
import type { SampleRegion } from './SampleRegion';
import { planStrum } from './Strum';
import { mulberry32 } from './random';
import { VoiceManager } from './VoiceManager';
import { midiToFrequency } from '../Music/Note';
import {
  isInstrumentId,
  LEGACY_INSTRUMENT_IDS,
  type AudioEngineState,
  type AudioStats,
  type InstrumentId,
  type NoteOffEvent,
  type NoteOnEvent,
  type PluckEvent,
  type StrumEvent,
} from './types';

/** 调度提前量：避免把事件排到过去，同时保持极低延迟。 */
const LOOKAHEAD = 0.005;

/** 合成回退用的谐波（仅在采样缺失/解码失败时使用） */
const FALLBACK_HARMONICS: [number, number][] = [
  [1, 1.0],
  [2, 0.25],
  [3, 0.12],
  [4, 0.06],
  [5, 0.03],
];

/** 扫弦间隔的合理区间（秒） */
const MIN_STRUM_INTERVAL = 0.005;
const MAX_STRUM_INTERVAL = 0.03;

export interface PlayNoteParams {
  midi: number;
  velocity?: number;
  duration?: number;
}

export interface PlayChordOptions {
  velocity?: number;
  strumDelay?: number;
  duration?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 归一化乐器 ID，兼容旧的 URL / localStorage 值。 */
export function normalizeInstrumentId(value: string): InstrumentId {
  if (isInstrumentId(value)) return value;
  return LEGACY_INSTRUMENT_IDS[value] ?? 'nylon_classical';
}

class AudioEngineClass {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  /** 所有 voice 的统一汇流点；切乐器时只改它的下游连接。 */
  private voiceBus: GainNode | null = null;

  private db = new SampleDatabase();
  private resolver = new SampleResolver(this.db);
  private cache: SampleCache | null = null;
  private voices: VoiceManager | null = null;
  private instruments: InstrumentManager | null = null;
  private chains = new Map<InstrumentId, EffectChain>();
  private activeChain: EffectChain | null = null;
  private packs = new SamplePackManager();

  /**
   * 主输出增益。UI 不再暴露音量滑杆 —— 响度由演奏力度决定
   * （力度既切换采样层，也线性影响振幅）。
   */
  private _volume = 0.7;
  private _instrument: InstrumentId = 'nylon_classical';
  private _strumInterval = 0.018;
  private _humanize = false;
  private _preferLowLatency = false;
  private _lastError: string | null = null;
  private _seed = 1;

  /** 状态变化回调（UI 可选订阅，引擎本身不渲染任何东西） */
  onStateChange?: (id: InstrumentId, state: AudioEngineState, error: string | null) => void;

  // ─── 生命周期 ────────────────────────────────────────

  /** 创建（或复用）AudioContext 与主输出链。必须在用户手势中调用。 */
  init(): boolean {
    // 复用已有 context 时不要在这里 resume：本方法会在挂载时被调用
    // （StrictMode 下甚至会调用两次），那不属于用户手势，浏览器会打印
    // "AudioContext was not allowed to start"。恢复交给 unlock()（手势入口）
    // 与 ensure()（真正发声前）。
    if (this.ctx) return true;

    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;

      const ctx = new Ctor({ latencyHint: 'interactive' });
      this.ctx = ctx;

      // 主输出链：voiceBus → 乐器链 → masterGain → limiter → destination
      this.voiceBus = ctx.createGain();

      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this._volume;

      this.limiter = ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -3;
      this.limiter.knee.value = 0;
      this.limiter.ratio.value = 20;
      this.limiter.attack.value = 0.002;
      this.limiter.release.value = 0.18;

      this.masterGain.connect(this.limiter);
      this.limiter.connect(ctx.destination);

      this.cache = new SampleCache(ctx, DEFAULT_CACHE_BUDGET_BYTES, this.db);
      this.instruments = new InstrumentManager(this.db, this.cache, this.resolver);
      this.instruments.onStateChange = (id, state, error) =>
        this.onStateChange?.(id, state, error);

      this.voices = new VoiceManager(ctx, this.voiceBus);
      this.activateChain(this._instrument);

      logger.log('AudioContext created', ctx.sampleRate, 'Hz');
      return true;
    } catch (error) {
      this._lastError = error instanceof Error ? error.message : String(error);
      logger.error('Failed to create AudioContext:', this._lastError);
      return false;
    }
  }

  /** 在用户手势中恢复被浏览器自动挂起的 context。 */
  resume(): void {
    if (this.ctx && this.ctx.state !== 'running') {
      void this.ctx.resume().catch(() => {
        /* 浏览器可能仍要求手势 */
      });
    }
  }

  /** 供 UI 在 pointerdown/keydown 里调用的解锁入口。 */
  unlock(): void {
    this.init();
    this.resume();
  }

  destroy(): void {
    this.stopAll();
    for (const chain of this.chains.values()) chain.dispose();
    this.chains.clear();
    this.activeChain = null;
    this.cache?.clear();
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.masterGain = null;
    this.limiter = null;
    this.voiceBus = null;
    this.cache = null;
    this.voices = null;
    this.instruments = null;
  }

  // ─── 乐器 ────────────────────────────────────────────

  /** 加载乐器（解析 SFZ + 建立索引 + 后台预加载）。 */
  async loadInstrument(id: InstrumentId | string): Promise<void> {
    const instrument = normalizeInstrumentId(String(id));
    if (!this.init() || !this.instruments) return;

    this._instrument = instrument;
    this.instruments.cancelPreload();
    this.resolver.resetRotation();

    // 旧乐器的 voice 不能污染新乐器
    if (this.ctx && this.voices) this.voices.stopAll(this.ctx.currentTime, 0.03);
    this.activateChain(instrument);

    await this.instruments.load(instrument);
  }

  /** 兼容旧 API（fire-and-forget）。 */
  setInstrument(id: InstrumentId | string): void {
    void this.loadInstrument(id);
  }

  getInstrument(): InstrumentId {
    return this._instrument;
  }

  getState(id?: InstrumentId): AudioEngineState {
    if (!this.instruments) return 'idle';
    return this.instruments.getState(id ?? this._instrument).state;
  }

  /** 检测四套音源是否就位（只返回状态，不做 UI 提示）。 */
  checkSamplePacks() {
    return this.packs.checkAll();
  }

  // ─── 演奏事件 ────────────────────────────────────────

  /** 拨弦：主要演奏事件。 */
  pluck(event: PluckEvent): boolean {
    const ctx = this.ensure();
    if (!ctx || !this.voices || !this.cache) return false;

    const midiNote = Math.round(event.midiNote);
    const velocity = clampVelocity(event.velocity ?? 100);
    const string = event.string ?? -1;
    const when = Math.max(event.when ?? 0, ctx.currentTime + LOOKAHEAD);

    this.instruments?.notePlayed(midiNote);
    this.voices.handleRetrigger(midiNote, string, when);

    const resolved = this.resolver.resolve(this._instrument, midiNote, velocity);
    if (!resolved) {
      // 该乐器完全没有可用 region —— 合成回退
      return this.startSynthFallback(
        midiNote,
        velocity,
        when,
        string,
        event.fret ?? -1,
        event.muted === true,
      );
    }

    const peak = this.velocityGain(velocity) * resolved.region.gain;
    const url = resolved.region.sampleUrl;
    const buffer = this.cache.get(url);

    if (buffer) {
      this.startSampleVoice(buffer, resolved.region, resolved.ratio, peak, when, midiNote, string, event);
    } else {
      // 精确映射优先：等这个采样解码完成再发声。
      // 冷启动时会比"就近替代"慢，但保证采样映射正确（见规范 §62 优先级）。
      if (this._preferLowLatency) {
        const substitute = this.findResidentSubstitute(midiNote);
        if (substitute) {
          this.startSampleVoice(
            substitute.buffer,
            substitute.region,
            substitute.ratio,
            this.velocityGain(velocity) * substitute.region.gain,
            when,
            midiNote,
            string,
            event,
          );
        }
      }

      void this.cache
        .load(url)
        .then((loaded) => {
          const startAt = Math.max(when, (this.ctx?.currentTime ?? 0) + LOOKAHEAD);
          this.startSampleVoice(loaded, resolved.region, resolved.ratio, peak, startAt, midiNote, string, event);
        })
        .catch(() => {
          this.startSynthFallback(
            midiNote,
            velocity,
            when,
            string,
            event.fret ?? -1,
            event.muted === true,
          );
        });
    }

    return true;
  }

  /** 按下（不自动释放；由 noteOff 结束）。 */
  noteOn(event: NoteOnEvent): boolean {
    return this.pluck({
      midiNote: event.midiNote,
      velocity: event.velocity,
      string: event.string,
      fret: event.fret,
      when: event.when,
    });
  }

  /** 松开：进入 release，让采样自然衰减。 */
  noteOff(event: NoteOffEvent): void {
    const ctx = this.ensure();
    if (!ctx || !this.voices) return;
    const when = Math.max(event.when ?? 0, ctx.currentTime);
    this.voices.releaseByMidi(Math.round(event.midiNote), when);
  }

  /**
   * 扫弦：由引擎按 direction / interval 在音频时钟上排程，不再依赖 setTimeout。
   */
  strum(event: StrumEvent): boolean {
    const ctx = this.ensure();
    if (!ctx) return false;

    const notes = event.notes ?? [];
    if (notes.length === 0) return false;

    const start = Math.max(event.when ?? 0, ctx.currentTime + LOOKAHEAD);
    const interval = clamp(
      event.interval ?? this._strumInterval,
      MIN_STRUM_INTERVAL,
      MAX_STRUM_INTERVAL,
    );

    const plan = planStrum(event, {
      start,
      interval,
      humanize: this._humanize,
      rng: mulberry32(this._seed++),
    });

    let started = 0;
    for (const item of plan) {
      if (this.pluck(item)) started++;
    }
    return started > 0;
  }

  /** 立即停止所有发声（带短淡出，避免 click）。 */
  stopAll(): void {
    const ctx = this.ctx;
    if (!ctx || !this.voices) return;
    this.voices.stopAll(ctx.currentTime, 0.02);
  }

  // ─── 兼容旧 API ──────────────────────────────────────

  /** @deprecated 使用 pluck()。保留以兼容现有 UI 调用点。 */
  playNote(params: PlayNoteParams): boolean {
    return this.pluck({
      midiNote: params.midi,
      velocity: params.velocity,
      duration: params.duration,
    });
  }

  /** @deprecated 使用 strum()。按 strumDelay 在音频时钟上排程。 */
  playChord(midiNotes: number[], options?: PlayChordOptions): boolean {
    const ctx = this.ensure();
    if (!ctx) return false;

    const { velocity, strumDelay = 0, duration } = options ?? {};
    const start = ctx.currentTime + LOOKAHEAD;
    // 完全同时触发时给一个 0.4ms 的微错开，避免相同采样相位叠加
    const step = strumDelay > 0 ? strumDelay / 1000 : 0.0004;

    let started = 0;
    midiNotes.forEach((midi, i) => {
      if (this.pluck({ midiNote: midi, velocity, duration, when: start + i * step })) started++;
    });
    return started > 0;
  }

  // ─── 参数 ────────────────────────────────────────────

  setVolume(volume: number): void {
    this._volume = clamp(volume, 0, 1);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this._volume, this.ctx.currentTime, 0.01);
    }
  }

  getVolume(): number {
    return this._volume;
  }

  /** 默认扫弦间隔（秒）。UI 的 0–200ms 滑杆由调用方换算后传入。 */
  setStrumInterval(seconds: number): void {
    this._strumInterval = clamp(seconds, MIN_STRUM_INTERVAL, MAX_STRUM_INTERVAL);
  }

  setHumanize(enabled: boolean): void {
    this._humanize = enabled;
  }

  /** 冷启动时允许用"已驻留的最近根音采样"替代，换取更低延迟。默认关闭。 */
  setPreferLowLatency(enabled: boolean): void {
    this._preferLowLatency = enabled;
  }

  setMaxVoices(count: number): void {
    this.voices?.setMaxVoices(count);
  }

  setCacheBudget(bytes: number): void {
    this.cache?.setBudget(bytes);
  }

  /** 调试日志开关（规范 §41）。 */
  set debug(enabled: boolean) {
    logger.enabled = enabled;
  }

  get debug(): boolean {
    return logger.enabled;
  }

  // ─── 统计 ────────────────────────────────────────────

  getStats(): AudioStats {
    const cacheStats: SampleCacheStats = this.cache?.stats() ?? {
      count: 0,
      bytes: 0,
      budgetBytes: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
    };

    return {
      state: this.getState(),
      currentInstrument: this._instrument,
      audioContextState: this.ctx?.state ?? 'uninitialized',
      activeVoices: this.voices?.activeCount ?? 0,
      peakVoices: this.voices?.peak ?? 0,
      maxVoices: this.voices?.max ?? 0,
      loadedSamples: cacheStats.count,
      cacheSize: cacheStats.count,
      cacheBytes: cacheStats.bytes,
      cacheBudgetBytes: cacheStats.budgetBytes,
      cacheHitRate: cacheStats.hitRate,
      cacheHits: cacheStats.hits,
      cacheMisses: cacheStats.misses,
      regions: this.db.regionCount(this._instrument),
      lastError: this._lastError,
    };
  }

  /** 测试/调试用：当前乐器全部 region（只读快照）。 */
  getRegions(instrument?: InstrumentId) {
    return this.db.getRegions(instrument ?? this._instrument);
  }

  /** 测试/调试用：解析而不播放。 */
  resolveSample(midiNote: number, velocity = 100, instrument?: InstrumentId) {
    return this.resolver.resolve(instrument ?? this._instrument, midiNote, velocity);
  }

  /** 当前乐器名（供 UI 显示）。 */
  getPresetName(id?: InstrumentId): string {
    return INSTRUMENT_PRESETS[id ?? this._instrument].name;
  }

  // ─── 内部 ────────────────────────────────────────────

  private ensure(): AudioContext | null {
    if (!this.ctx && !this.init()) return null;
    this.resume();
    return this.ctx;
  }

  /** 切换 voiceBus 的下游到指定乐器的效果链。 */
  private activateChain(id: InstrumentId): void {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || !this.voiceBus) return;

    let chain = this.chains.get(id);
    if (!chain) {
      chain = new EffectChain(ctx, getPreset(id), this.masterGain);
      this.chains.set(id, chain);
    }

    if (this.activeChain === chain) return;
    try {
      this.voiceBus.disconnect();
    } catch {
      /* 尚未连接 */
    }
    this.voiceBus.connect(chain.input);
    this.activeChain = chain;
  }

  private startSampleVoice(
    buffer: AudioBuffer,
    region: SampleRegion,
    ratio: number,
    peak: number,
    when: number,
    midiNote: number,
    string: number,
    event: PluckEvent,
  ): void {
    const voices = this.voices;
    if (!voices || !this.cache) return;

    const url = region.sampleUrl;
    this.cache.retain(url);

    const voice = voices.acquire(
      {
        id: 0,
        midiNote,
        string,
        fret: event.fret ?? -1,
        velocity: clampVelocity(event.velocity ?? 100),
        muted: event.muted === true,
      },
      () => this.cache?.release(url),
    );

    voice.startSample(when, buffer, region, ratio, peak);

    if (event.duration !== undefined && event.duration > 0) {
      voice.release(when + event.duration);
    }
  }

  private startSynthFallback(
    midiNote: number,
    velocity: number,
    when: number,
    string: number,
    fret: number,
    muted: boolean,
  ): boolean {
    const voices = this.voices;
    if (!voices) return false;

    const voice = voices.acquire({
      id: 0,
      midiNote,
      string,
      fret,
      velocity,
      muted,
    });
    voice.startSynth(
      when,
      midiToFrequency(midiNote),
      this.velocityGain(velocity) * 0.35,
      FALLBACK_HARMONICS,
    );
    logger.warn(
      `no sample region for midi ${midiNote} on ${this._instrument}; using synth fallback`,
    );
    return true;
  }

  /** 在同一乐器里找一个已解码、根音最接近的采样作为低延迟替代。 */
  private findResidentSubstitute(
    midiNote: number,
  ): { buffer: AudioBuffer; region: SampleRegion; ratio: number } | null {
    if (!this.cache) return null;

    const covering = this.db.getByKey(this._instrument, midiNote);
    const pool = covering.length > 0 ? covering : this.db.getRegions(this._instrument);

    let best: { buffer: AudioBuffer; region: SampleRegion; ratio: number } | null = null;
    let bestDistance = Infinity;

    for (const region of pool) {
      const buffer = this.cache.get(region.sampleUrl);
      if (!buffer) continue;
      const distance = Math.abs(region.rootKey - midiNote);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { buffer, region, ratio: Math.pow(2, (midiNote - region.rootKey) / 12) };
      }
    }

    return best;
  }

  /** 力度 → 线性增益。采样本身已按力度分层录制，这里只做轻微曲线，避免二次衰减。 */
  private velocityGain(velocity: number): number {
    return Math.pow(clampVelocity(velocity) / 127, 0.8);
  }
}

export const AudioEngine = new AudioEngineClass();
export type { InstrumentId, AudioStats };

// 开发期把引擎挂到 window，方便在控制台调试（生产构建会被 tree-shake 掉）。
// 动态导入避免与 devtools.ts 形成循环依赖。
if (import.meta.env?.DEV) {
  void import('./devtools').then(({ installDevTools }) => installDevTools());
}
