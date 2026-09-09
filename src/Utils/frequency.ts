/**
 * frequency.ts — 音频频率工具
 *
 * 封装 AudioContext 的延迟初始化检查。
 * 所有音频相关操作先通过此处确认 AudioContext 就绪。
 */

import { AudioEngine } from '../Audio/AudioEngine';

/** 确保 AudioEngine 已初始化（用户首次点击时调用） */
export function ensureAudioReady(): void {
  AudioEngine.init();
}
