/**
 * EnvelopeEngine.ts — 吉他拨弦包络
 *
 * 设计原则：WAV 自身的自然衰减才是声音的主体。
 * 所以这里只做两件事：
 *   - 极短的 attack（避免起音爆音）
 *   - noteOff 时的 release（避免"啪"地突然静音）
 * 中间不做 decay/sustain 塑形，否则会把采样吉他变成合成器。
 */

/** 起音时间（秒）——足够短，听不出渐变，但能消除 click */
export const ATTACK_TIME = 0.002;

/** 闷音释放时间（秒） */
export const MUTE_RELEASE = 0.09;

export const EnvelopeEngine = {
  /** 从 0 线性升到 peak。 */
  scheduleAttack(gain: AudioParam, when: number, peak: number): void {
    gain.cancelScheduledValues(when);
    gain.setValueAtTime(0, when);
    gain.linearRampToValueAtTime(peak, when + ATTACK_TIME);
  },

  /**
   * 从 when 时刻的包络值自然衰减到 0。
   *
   * 支持提前排程（例如 pluck 时给定 duration）：此时 gain.value 还是 0，
   * 必须用 cancelAndHoldAtTime 让自动化自己求出 when 时刻的值，
   * 否则会在释放点把音量直接拽到 0。
   *
   * @param peak 起音峰值，作为不支持 cancelAndHoldAtTime 时的回退值
   * @returns 可以安全销毁该 voice 的时间点
   */
  scheduleRelease(gain: AudioParam, when: number, release: number, peak = 1): number {
    const timeConstant = Math.max(0.01, release / 4);

    const holdable = gain as AudioParam & {
      cancelAndHoldAtTime?: (time: number) => void;
    };
    if (typeof holdable.cancelAndHoldAtTime === 'function') {
      holdable.cancelAndHoldAtTime(when);
    } else {
      gain.cancelScheduledValues(when);
      gain.setValueAtTime(peak, when);
    }
    gain.setTargetAtTime(0, when, timeConstant);
    return when + timeConstant * 6;
  },

  /** 偷声/急停用的短交叉淡出，避免 click。 */
  scheduleQuickFade(gain: AudioParam, when: number, duration = 0.008): number {
    const current = Math.max(gain.value, 0.0001);
    gain.cancelScheduledValues(when);
    gain.setValueAtTime(current, when);
    gain.linearRampToValueAtTime(0, when + duration);
    return when + duration;
  },

  /** 闷音：让低通快速收拢，配合短释放。 */
  scheduleMuteDamping(filter: BiquadFilterNode, when: number, duration: number): void {
    filter.frequency.cancelScheduledValues(when);
    filter.frequency.setValueAtTime(Math.max(filter.frequency.value, 400), when);
    filter.frequency.exponentialRampToValueAtTime(260, when + duration);
  },
};
