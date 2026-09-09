/**
 * EffectChain.ts — 每件乐器的信号链
 *
 *   input(Gain) → 低频搁架 → 中频峰值 → 高频搁架 → [过载段] → output(Gain)
 *
 * 过载段只在 preset.effects.overdrive === 'dsp' 时接入。
 * 当前四套音源都是"采样即最终音色"，因此默认不接。
 */

import type { InstrumentPreset } from './InstrumentPreset';
import { drivePostGain, drivePreGain, driveToneFrequency, makeSaturationCurve } from './Overdrive';

export class EffectChain {
  readonly input: GainNode;
  readonly output: GainNode;

  private low: BiquadFilterNode;
  private mid: BiquadFilterNode;
  private high: BiquadFilterNode;
  private preGain: GainNode | null = null;
  private shaper: WaveShaperNode | null = null;
  private postGain: GainNode | null = null;
  private tone: BiquadFilterNode | null = null;
  private disposed = false;

  constructor(ctx: BaseAudioContext, preset: InstrumentPreset, destination: AudioNode) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.output.gain.value = preset.gain;

    this.low = ctx.createBiquadFilter();
    this.low.type = 'lowshelf';
    this.low.frequency.value = 220;

    this.mid = ctx.createBiquadFilter();
    this.mid.type = 'peaking';
    this.mid.frequency.value = 900;
    this.mid.Q.value = 0.8;

    this.high = ctx.createBiquadFilter();
    this.high.type = 'highshelf';
    this.high.frequency.value = 3600;

    this.applyEq(preset.effects.eq.low, preset.effects.eq.mid, preset.effects.eq.high);

    // EQ 串联
    this.input.connect(this.low);
    this.low.connect(this.mid);
    this.mid.connect(this.high);

    if (preset.effects.overdrive === 'dsp') {
      this.preGain = ctx.createGain();
      this.shaper = ctx.createWaveShaper();
      this.shaper.oversample = '2x';
      this.shaper.curve = makeSaturationCurve(preset.effects.drive);
      this.tone = ctx.createBiquadFilter();
      this.tone.type = 'lowpass';
      this.tone.frequency.value = driveToneFrequency(preset.effects.drive);
      this.postGain = ctx.createGain();
      this.postGain.gain.value = drivePostGain(preset.effects.drive);
      this.preGain.gain.value = drivePreGain(preset.effects.drive);

      this.high.connect(this.preGain);
      this.preGain.connect(this.shaper);
      this.shaper.connect(this.tone);
      this.tone.connect(this.postGain);
      this.postGain.connect(this.output);
    } else {
      this.high.connect(this.output);
    }

    this.output.connect(destination);
  }

  /** 调整过载量（0 = 完全干净）。仅对 'dsp' 预设有效。 */
  setDrive(drive: number): void {
    if (this.disposed || !this.shaper || !this.preGain || !this.postGain || !this.tone) return;
    const d = Math.max(0, Math.min(1, drive));
    this.shaper.curve = makeSaturationCurve(d);
    this.preGain.gain.value = drivePreGain(d);
    this.postGain.gain.value = drivePostGain(d);
    this.tone.frequency.value = driveToneFrequency(d);
  }

  setEq(low: number, mid: number, high: number): void {
    if (this.disposed) return;
    this.applyEq(low, mid, high);
  }

  setGain(gain: number): void {
    if (this.disposed) return;
    this.output.gain.value = Math.max(0, gain);
  }

  getGain(): number {
    return this.output.gain.value;
  }

  private applyEq(low: number, mid: number, high: number): void {
    this.low.gain.value = low;
    this.mid.gain.value = mid;
    this.high.gain.value = high;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const node of [
      this.input,
      this.low,
      this.mid,
      this.high,
      this.preGain,
      this.shaper,
      this.tone,
      this.postGain,
      this.output,
    ]) {
      try {
        node?.disconnect();
      } catch {
        /* 忽略 */
      }
    }
  }

  /** 便于测试与调试：当前是否启用了 DSP 过载。 */
  get hasDrive(): boolean {
    return this.shaper !== null;
  }
}
