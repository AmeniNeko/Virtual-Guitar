/**
 * Overdrive.ts — 软削波饱和
 *
 * 信号链：inputGain → 非线性饱和 → outputGain 补偿
 * 输出被 tanh 限制在 ±1 内，不会产生数字削波。
 *
 * 当前四个预设都不启用它（采样本身已经是目标音色），
 * 但保留完整实现，供"干净采样 + DSP"模式使用。
 */

const CURVE_POINTS = 2048;

/** 生成 WaveShaperNode 的曲线。drive <= 0 时返回恒等曲线（完全透明）。 */
export function makeSaturationCurve(drive: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(CURVE_POINTS * Float32Array.BYTES_PER_ELEMENT));
  const d = Math.max(0, Math.min(1, drive));

  if (d <= 0) {
    for (let i = 0; i < CURVE_POINTS; i++) {
      curve[i] = (i / (CURVE_POINTS - 1)) * 2 - 1;
    }
    return curve;
  }

  const k = 1 + d * 24;
  const norm = Math.tanh(k);
  for (let i = 0; i < CURVE_POINTS; i++) {
    const x = (i / (CURVE_POINTS - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  return curve;
}

/** 输入增益：把信号推进饱和区。 */
export function drivePreGain(drive: number): number {
  return 1 + Math.max(0, Math.min(1, drive)) * 6;
}

/** 输出增益：补偿饱和带来的响度提升，保证输出仍接近 [-1, 1]。 */
export function drivePostGain(drive: number): number {
  return 1 / (1 + Math.max(0, Math.min(1, drive)) * 2.2);
}

/** 音色控制：drive 越大，高频越收敛（模拟音箱的高频滚降）。 */
export function driveToneFrequency(drive: number): number {
  return 5200 - Math.max(0, Math.min(1, drive)) * 2400;
}
