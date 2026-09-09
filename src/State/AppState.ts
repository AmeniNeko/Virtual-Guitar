/**
 * AppState.ts — 应用全局状态定义
 *
 * 统一的状态类型，所有 UI 组件通过 Context 读写。
 */

import type { NoteName } from '../Music/Note';

export type PlayMode = 'play' | 'chord' | 'scale';

export interface AppState {
  /** 调弦 ID */
  tuning: string;
  /** Capo 品位 (0-12) */
  capo: number;
  /** 指板品数 */
  fretCount: number;
  /** 音色 */
  instrument: string;
  /** 音量 0-1 */
  volume: number;
  /** 延音 0-1 */
  sustain: number;
  /** 扫弦速度 ms */
  strumSpeed: number;
  /** 默认力度 0-1 */
  velocity: number;
  /** 人性化 */
  humanize: boolean;
  /** 当前模式 */
  mode: PlayMode;
  /** 选中的和弦类型 ID */
  selectedChordType?: string;
  /** 选中的音阶类型 ID */
  selectedScaleType?: string;
  /** 选中的根音 */
  rootNote?: NoteName;
  /** 是否录音中 */
  isRecording: boolean;
  /** 当前选中的和弦分组索引 */
  selectedGroup: number;
  /** 演奏模式是否显示音名 */
  showNoteNames: boolean;
}

export const DEFAULT_STATE: AppState = {
  tuning: 'standard',
  capo: 0,
  fretCount: 12,
  instrument: 'acoustic',
  volume: 0.5,
  sustain: 0.7,
  strumSpeed: 30,
  velocity: 0.7,
  humanize: false,
  mode: 'play',
  rootNote: 'C',
  isRecording: false,
  selectedGroup: 0,
  showNoteNames: false,
};
