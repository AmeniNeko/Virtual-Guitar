/**
 * frequency.ts — 音频就绪工具
 *
 * 所有音频相关操作都可以先通过此处确认 AudioContext 就绪。
 * 必须在用户手势（pointerdown / keydown）中调用，否则浏览器会拒绝启动音频。
 */

import { AudioEngine } from '../Audio/AudioEngine';
import { normalizeInstrumentId } from '../Audio/AudioEngine';
import type { InstrumentId } from '../Audio/types';

/**
 * 解锁并（可选）加载乐器。
 * @param instrument 需要加载的音色 ID，省略则只解锁 AudioContext
 */
export function ensureAudioReady(instrument?: InstrumentId | string): void {
  AudioEngine.unlock();
  if (instrument) {
    void AudioEngine.loadInstrument(normalizeInstrumentId(String(instrument)));
  }
}
