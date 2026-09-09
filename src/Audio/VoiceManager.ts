/**
 * VoiceManager.ts — 多声部管理
 *
 * 至少 32 个同时发声的 voice：六弦和弦 + 扫弦 + release 尾巴很容易超过 16。
 *
 * 偷声优先级（从先到后）：
 *   1. 尚未开始发声的排程 voice
 *   2. 已进入 release 的 voice（无论当前音量）
 *   3. 起音窗口之外的、最早启动的 voice
 *   4. 最后才考虑起音窗口内的 voice，并且用短交叉淡出
 *
 * 刻意不做「同 MIDI 就杀掉前一个」——吉他快速重复拨弦必须能多个 voice 共存。
 */

import { Voice, type VoiceInit } from './Voice';

export interface VoiceManagerOptions {
  maxVoices?: number;
  /**
   * 同弦同音重触发时，旧 voice 的快速释放时间（秒）。
   * 0 = 完全重叠（默认，符合"快速重复拨弦不丢音"的要求）。
   */
  retriggerRelease?: number;
}

export const DEFAULT_MAX_VOICES = 32;

export class VoiceManager {
  private voices = new Set<Voice>();
  private nextId = 1;
  private peakCount = 0;
  private maxVoices: number;
  private retriggerRelease: number;
  private ctx: BaseAudioContext;
  private destination: AudioNode;

  constructor(ctx: BaseAudioContext, destination: AudioNode, options: VoiceManagerOptions = {}) {
    this.ctx = ctx;
    this.destination = destination;
    this.maxVoices = Math.max(1, options.maxVoices ?? DEFAULT_MAX_VOICES);
    this.retriggerRelease = Math.max(0, options.retriggerRelease ?? 0);
  }

  setMaxVoices(n: number): void {
    this.maxVoices = Math.max(1, n);
  }

  get max(): number {
    return this.maxVoices;
  }

  get activeCount(): number {
    return this.voices.size;
  }

  get peak(): number {
    return this.peakCount;
  }

  get all(): Voice[] {
    return [...this.voices];
  }

  /**
   * 取一个 voice slot。达到上限时会偷声。
   * 返回的 Voice 尚未启动，调用方必须立刻 startSample/startSynth。
   *
   * @param onEnded voice 销毁后的额外回调（例如释放采样缓存引用）
   */
  acquire(init: Omit<VoiceInit, 'destination'>, onEnded?: (voice: Voice) => void): Voice {
    const now = this.ctx.currentTime;

    if (this.voices.size >= this.maxVoices) {
      const victim = this.chooseVictim(now);
      if (victim) {
        victim.stopImmediately(now);
        this.unregister(victim);
      }
    }

    const voice = new Voice(this.ctx, { ...init, destination: this.destination });
    voice.onEnded = (v) => {
      this.unregister(v);
      onEnded?.(v);
    };
    this.voices.add(voice);
    this.nextId++;
    if (this.voices.size > this.peakCount) this.peakCount = this.voices.size;
    return voice;
  }

  /** 释放某个音高的所有 voice（noteOff）。 */
  releaseByMidi(midiNote: number, when: number): number {
    let count = 0;
    for (const voice of this.voices) {
      if (voice.midiNote === midiNote && !voice.finished) {
        voice.release(when);
        count++;
      }
    }
    return count;
  }

  /**
   * 同弦同音重触发处理。默认 retriggerRelease = 0（不干预）。
   * @returns 被快速释放的 voice 数量
   */
  handleRetrigger(midiNote: number, string: number, when: number): number {
    if (this.retriggerRelease <= 0) return 0;
    let count = 0;
    for (const voice of this.voices) {
      if (
        voice.midiNote === midiNote &&
        voice.string === string &&
        !voice.finished &&
        voice.releaseTime === null
      ) {
        voice.release(when + this.retriggerRelease);
        count++;
      }
    }
    return count;
  }

  /** 全部进入 release（stopAll 的"自然停止"版本）。 */
  releaseAll(when: number): void {
    for (const voice of this.voices) voice.release(when);
  }

  /** 全部立刻停止（切乐器/关闭时使用）。 */
  stopAll(when: number, fade = 0.02): void {
    for (const voice of this.voices) voice.stopImmediately(when, fade);
  }

  /** 取消所有尚未开始发声的排程 voice。 */
  cancelScheduled(): number {
    const now = this.ctx.currentTime;
    let count = 0;
    for (const voice of this.voices) {
      voice.syncState(now);
      if (voice.state === 'scheduled') {
        voice.cancel();
        count++;
      }
    }
    return count;
  }

  private unregister(voice: Voice): void {
    this.voices.delete(voice);
  }

  private chooseVictim(now: number): Voice | null {
    const candidates = [...this.voices].filter((v) => !v.finished);
    if (candidates.length === 0) return null;

    for (const voice of candidates) voice.syncState(now);

    const scheduled = candidates.filter((v) => v.state === 'scheduled');
    if (scheduled.length > 0) return scheduled[0];

    const releasing = candidates.filter((v) => v.state === 'release');
    const held = candidates.filter((v) => v.state !== 'release');
    const outsideAttack = held.filter((v) => !v.isInAttackWindow(now));

    const pool = releasing.length > 0 ? releasing : outsideAttack.length > 0 ? outsideAttack : held;

    return pool.reduce((worst, v) => {
      if (v.startTime < worst.startTime) return v;
      if (v.startTime === worst.startTime && v.currentGain < worst.currentGain) return v;
      return worst;
    });
  }
}
