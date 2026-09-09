/**
 * AudioEngine.ts — Web Audio 音频引擎
 *
 * 修复：
 * - 使用 generation ID 防止旧 note 的 onended 误删新 note
 * - 完整断开旧振荡器连接
 * - 统一包络控制
 */

import { midiToFrequency } from '../Music/Note';

export type InstrumentType = 'acoustic' | 'nylon' | 'clean-electric';

export interface PlayNoteParams {
  midi: number;
  velocity?: number;
  duration?: number;
}

interface ActiveNote {
  oscillators: OscillatorNode[];
  oscGains: GainNode[];
  gainNode: GainNode;
  generation: number;
}

const ADSR = {
  attack: 0.005,
  decay: 0.08,
  release: 0.3,
};

const HARMONICS: [number, number][] = [
  [1, 1.0],
  [2, 0.25],
  [3, 0.12],
  [4, 0.06],
  [5, 0.03],
];

class AudioEngineClass {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private activeNotes: Map<number, ActiveNote> = new Map();
  private generation: Map<number, number> = new Map();
  private _volume = 0.5;
  private _sustainTime = 2.0;

  init(): boolean {
    if (this.ctx) return true;
    try {
      this.ctx = new AudioContext();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._volume;

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  private ensureRunning(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private getCtx(): AudioContext | null {
    if (!this.ctx) this.init();
    this.ensureRunning();
    return this.ctx;
  }

  private getOutput(): AudioNode | null {
    return this.compressor ?? this.masterGain;
  }

  setVolume(vol: number): void {
    this._volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this._volume, this.ctx.currentTime, 0.01);
    }
  }

  setSustainTime(seconds: number): void {
    this._sustainTime = Math.max(0.1, Math.min(5.0, seconds));
  }

  playNote(params: PlayNoteParams): boolean {
    const ctx = this.getCtx();
    if (!ctx || !this.getOutput()) return false;

    const { midi, velocity = 0.7, duration = this._sustainTime } = params;
    const freq = midiToFrequency(midi);
    const now = ctx.currentTime;

    // 先彻底清理旧音符
    this.cleanupNote(midi);

    // 递增 generation
    const gen = (this.generation.get(midi) ?? 0) + 1;
    this.generation.set(midi, gen);

    // 包络节点
    const gainNode = ctx.createGain();
    const peak = velocity * 0.5;
    const sus = peak * 0.6;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(peak, now + ADSR.attack);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.001, sus), now + ADSR.attack + ADSR.decay);

    const releaseStart = now + Math.max(duration * 0.6, ADSR.attack + ADSR.decay + 0.1);
    gainNode.gain.setTargetAtTime(0.001, releaseStart, ADSR.release);

    gainNode.connect(this.getOutput()!);

    // 振荡器
    const oscillators: OscillatorNode[] = [];
    const oscGains: GainNode[] = [];

    for (const [ratio, amp] of HARMONICS) {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = ratio === 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq * ratio, now);
      oscGain.gain.setValueAtTime(amp * velocity * 0.4, now);
      osc.connect(oscGain);
      oscGain.connect(gainNode);
      oscillators.push(osc);
      oscGains.push(oscGain);
    }

    const stopTime = now + duration + ADSR.release + 0.5;
    oscillators.forEach((osc) => { osc.start(now); osc.stop(stopTime); });

    this.activeNotes.set(midi, { oscillators, oscGains, gainNode, generation: gen });

    // 清理：只在 generation 匹配时执行
    oscillators[0].onended = () => {
      if (this.generation.get(midi) === gen) {
        this.activeNotes.delete(midi);
        this.generation.delete(midi);
      }
      this.disconnectNodes(gainNode, oscGains, oscillators);
    };

    return true;
  }

  private cleanupNote(midi: number): void {
    const active = this.activeNotes.get(midi);
    if (!active) return;

    // 快速淡出
    const ctx = this.ctx;
    if (ctx) {
      const now = ctx.currentTime;
      active.gainNode.gain.cancelScheduledValues(now);
      const currentVal = active.gainNode.gain.value;
      active.gainNode.gain.setValueAtTime(currentVal > 0.001 ? currentVal : 0.001, now);
      active.gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    }

    // 立即停止振荡器
    active.oscillators.forEach((osc) => {
      try { osc.stop(); } catch { /* 已停止 */ }
    });

    // 断开连接
    this.disconnectNodes(active.gainNode, active.oscGains, active.oscillators);

    this.activeNotes.delete(midi);
  }

  private disconnectNodes(gainNode: GainNode, oscGains: GainNode[], oscillators: OscillatorNode[]): void {
    try { gainNode.disconnect(); } catch { /* 忽略 */ }
    oscGains.forEach((g) => { try { g.disconnect(); } catch { /* 忽略 */ } });
    oscillators.forEach((o) => { try { o.disconnect(); } catch { /* 忽略 */ } });
  }

  stopAll(): void {
    const mids = Array.from(this.activeNotes.keys());
    mids.forEach((m) => this.cleanupNote(m));
  }

  playChord(
    midiNotes: number[],
    options?: { velocity?: number; strumDelay?: number; duration?: number }
  ): boolean {
    const { velocity = 0.7, strumDelay = 0, duration = this._sustainTime } = options ?? {};
    midiNotes.forEach((midi, i) => {
      setTimeout(() => this.playNote({ midi, velocity, duration }), i * strumDelay);
    });
    return true;
  }

  destroy(): void {
    this.stopAll();
    if (this.ctx) { this.ctx.close().catch(() => {}); this.ctx = null; }
    this.masterGain = null;
    this.compressor = null;
  }
}

export const AudioEngine = new AudioEngineClass();
