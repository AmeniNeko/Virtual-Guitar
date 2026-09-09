/**
 * Voice.ts — 单个发声实例
 *
 * 一次拨弦 = 一个 Voice。Voice 拥有自己的节点图：
 *   AudioBufferSourceNode → GainNode(包络) → [BiquadFilter(闷音)] → 输出
 *
 * Voice 不感知 SFZ；它只接收"播放哪个 buffer、什么速率、什么包络"。
 */

import { EnvelopeEngine, MUTE_RELEASE } from './EnvelopeEngine';
import type { LoopMode, SampleRegion } from './SampleRegion';

export type VoiceState = 'scheduled' | 'attack' | 'sustain' | 'release' | 'finished';

export interface VoiceInit {
  id: number;
  midiNote: number;
  /** 0 = 6 弦 … 5 = 1 弦；-1 表示未知（例如键盘/录制回放） */
  string: number;
  fret: number;
  velocity: number;
  muted: boolean;
  /** 输出总线 */
  destination: AudioNode;
}

export class Voice {
  readonly id: number;
  readonly midiNote: number;
  readonly string: number;
  readonly fret: number;
  readonly velocity: number;
  readonly muted: boolean;

  state: VoiceState = 'scheduled';
  startTime = 0;
  /** 被请求释放的时间；null 表示仍在按住 */
  releaseTime: number | null = null;
  /** 采样 URL，用于释放 cache 引用 */
  sampleUrl: string | null = null;
  /** 音源被安排的停止时刻（调试/测试用） */
  scheduledStopTime: number | null = null;

  onEnded?: (voice: Voice) => void;

  private gain: GainNode;
  private filter: BiquadFilterNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private synth: { osc: OscillatorNode; gain: GainNode }[] = [];
  private released = false;
  private disposed = false;
  private peakGain = 1;
  private releaseSeconds = 0.3;
  private ctx: BaseAudioContext;

  constructor(ctx: BaseAudioContext, init: VoiceInit) {
    this.ctx = ctx;
    this.id = init.id;
    this.midiNote = init.midiNote;
    this.string = init.string;
    this.fret = init.fret;
    this.velocity = init.velocity;
    this.muted = init.muted;

    this.gain = ctx.createGain();
    this.gain.gain.value = 0;

    if (init.muted) {
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 1800;
      this.filter.Q.value = 0.7;
      this.gain.connect(this.filter);
      this.filter.connect(init.destination);
    } else {
      this.gain.connect(init.destination);
    }
  }

  /** 当前包络值，用于偷声优先级排序。 */
  get currentGain(): number {
    return this.gain.gain.value;
  }

  /** 采样播放速率（供调试）。 */
  get sampleSource(): AudioBufferSourceNode | null {
    return this.source;
  }

  /**
   * 播放一个采样。
   * @param when 绝对 AudioContext 时间
   * @param peak 包络峰值（力度映射后的线性增益）
   */
  startSample(
    when: number,
    buffer: AudioBuffer,
    region: SampleRegion,
    ratio: number,
    peak: number,
  ): void {
    if (this.disposed) return;

    this.sampleUrl = region.sampleUrl;
    this.peakGain = peak;
    this.releaseSeconds = region.release;
    this.startTime = when;
    this.state = when > this.ctx.currentTime + 0.001 ? 'scheduled' : 'attack';

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = ratio;
    applyLoop(source, region, buffer);
    source.connect(this.gain);

    const offset = buffer.duration > 0 ? Math.min(region.offset / buffer.sampleRate, buffer.duration) : 0;
    const endSeconds =
      region.end > 0 ? Math.min(region.end / buffer.sampleRate, buffer.duration) : buffer.duration;
    const duration = Math.max(0, endSeconds - offset) || undefined;

    EnvelopeEngine.scheduleAttack(this.gain.gain, when, peak);
    if (this.filter) EnvelopeEngine.scheduleMuteDamping(this.filter, when, MUTE_RELEASE);

    source.onended = () => this.handleEnded();
    this.source = source;
    try {
      source.start(when, offset, duration);
    } catch {
      // 极端情况下（when 已过期、buffer 已释放）退化为立即播放
      try {
        source.start();
      } catch {
        this.handleEnded();
        return;
      }
    }

    if (this.state === 'attack') this.state = 'sustain';
  }

  /**
   * 合成回退：采样缺失或解码失败时使用。
   * 只在没有可用采样时才会被调用。
   */
  startSynth(when: number, frequency: number, peak: number, harmonics: [number, number][]): void {
    if (this.disposed) return;

    this.peakGain = peak;
    this.releaseSeconds = this.muted ? MUTE_RELEASE : 0.35;
    this.startTime = when;
    this.state = when > this.ctx.currentTime + 0.001 ? 'scheduled' : 'attack';

    const total = harmonics.reduce((sum, [, amp]) => sum + amp, 0) || 1;
    for (const [ratio, amp] of harmonics) {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = ratio === 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(frequency * ratio, when);
      oscGain.gain.setValueAtTime((amp / total) * peak, when);
      osc.connect(oscGain);
      oscGain.connect(this.gain);
      this.synth.push({ osc, gain: oscGain });
    }

    EnvelopeEngine.scheduleAttack(this.gain.gain, when, 1);
    if (this.filter) EnvelopeEngine.scheduleMuteDamping(this.filter, when, MUTE_RELEASE);

    const last = this.synth[this.synth.length - 1];
    if (last) last.osc.onended = () => this.handleEnded();
    for (const { osc } of this.synth) {
      try {
        osc.start(when);
      } catch {
        /* 已启动 */
      }
    }

    this.state = 'sustain';
  }

  /**
   * 让 state 与音频时钟对齐。
   *
   * 排程到未来的 voice 没有定时器去"唤醒"它，所以 scheduled → sustain
   * 的转换是惰性计算的。偷声与取消前必须先调用，否则已开始发声的 voice
   * 会被误判为"可以自由取消的排程 voice"。
   */
  syncState(now: number): void {
    if (this.state === 'scheduled' && now >= this.startTime) this.state = 'sustain';
  }

  /**
   * 进入 release。幂等。
   * 释放时间早于起音时间（尚未发声就被释放）时直接取消，避免产生一个空 voice。
   */
  release(when: number): void {
    if (this.released || this.disposed) return;
    if (when < this.startTime) {
      this.cancel();
      return;
    }
    this.released = true;
    this.releaseTime = when;
    this.state = 'release';

    const release = this.muted ? MUTE_RELEASE : this.releaseSeconds;
    const end = EnvelopeEngine.scheduleRelease(this.gain.gain, when, release, this.peakGain);
    this.stopSourcesAt(end);
  }

  /** 偷声/急停：短淡出后销毁。 */
  stopImmediately(when: number, fade = 0.008): void {
    if (this.disposed) return;
    this.released = true;
    this.state = 'release';
    const end = EnvelopeEngine.scheduleQuickFade(this.gain.gain, when, fade);
    this.stopSourcesAt(end);
  }

  /** 尚未开始发声就取消（例如切乐器时清理已排程的 voice）。 */
  cancel(): void {
    if (this.disposed) return;
    this.released = true;
    // 走 handleEnded 而不是直接 dispose：必须通知 VoiceManager 注销，否则会泄漏 slot
    this.handleEnded();
  }

  private stopSourcesAt(when: number): void {
    this.scheduledStopTime = when;
    if (this.source) {
      try {
        this.source.stop(when);
      } catch {
        /* 已结束 */
      }
    }
    for (const { osc } of this.synth) {
      try {
        osc.stop(when);
      } catch {
        /* 已结束 */
      }
    }
  }

  private handleEnded(): void {
    if (this.disposed) return;
    this.state = 'finished';
    this.dispose();
    this.onEnded?.(this);
  }

  private dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.source?.disconnect();
    } catch {
      /* 忽略 */
    }
    for (const { osc, gain } of this.synth) {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        /* 忽略 */
      }
    }
    try {
      this.gain.disconnect();
      this.filter?.disconnect();
    } catch {
      /* 忽略 */
    }
    this.source = null;
    this.synth = [];
  }

  get finished(): boolean {
    return this.state === 'finished';
  }

  get peak(): number {
    return this.peakGain;
  }

  /** 是否仍在起音窗口内（偷声时尽量避开）。 */
  isInAttackWindow(now: number): boolean {
    return now - this.startTime < 0.03;
  }
}

function applyLoop(source: AudioBufferSourceNode, region: SampleRegion, buffer: AudioBuffer): void {
  if (region.loopMode === 'no_loop' || region.loopMode === 'one_shot') return;
  if (region.loopEnd <= region.loopStart) return;

  const loopStart = region.loopStart / buffer.sampleRate;
  const loopEnd = region.loopEnd / buffer.sampleRate;
  if (loopEnd > buffer.duration || loopEnd <= loopStart) return;

  source.loop = true;
  source.loopStart = loopStart;
  source.loopEnd = loopEnd;
}

export type { LoopMode };
