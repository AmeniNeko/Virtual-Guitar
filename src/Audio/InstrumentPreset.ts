/**
 * InstrumentPreset.ts — 四个乐器预设
 *
 * 路径基于 Vite 的 public/ 目录（根路径）。目录名包含空格与 `+`，
 * 因此这里保存的是**未编码**的路径，统一由 encodePath 处理。
 *
 * 原始音源目录结构不一致（FSS / 两套电吉他双层嵌套，西班牙吉他单层），
 * 所以每个 preset 显式声明自己的 SFZ 位置，而不是靠扫描猜测。
 */

import type { InstrumentId } from './types';

export interface EqSpec {
  /** 低频搁架增益（dB） */
  low: number;
  /** 中频峰值增益（dB） */
  mid: number;
  /** 高频搁架增益（dB） */
  high: number;
}

export interface EffectSpec {
  /**
   * 'none' = 直接使用采样（采样本身已经是目标音色）
   * 'dsp'  = 用干净采样 + DSP 过载
   */
  overdrive: 'none' | 'dsp';
  /** 0..1，仅当 overdrive = 'dsp' 生效 */
  drive: number;
  eq: EqSpec;
}

export interface InstrumentPreset {
  id: InstrumentId;
  /** 完整显示名 */
  name: string;
  /** UI 按钮上的短名（4 字） */
  shortName: string;
  /** 未编码的绝对目录，以 / 结尾 */
  sfzDir: string;
  /** SFZ 文件名 */
  sfzFile: string;
  license: string;
  /** 预设整体增益 */
  gain: number;
  /** 立体声位置 -1..1 */
  pan: number;
  effects: EffectSpec;
  /** 预加载核心音域 */
  coreRange: [number, number];
}

const SOUNDS = '/sounds';

export const INSTRUMENT_PRESETS: Record<InstrumentId, InstrumentPreset> = {
  steel_acoustic: {
    id: 'steel_acoustic',
    name: '钢弦木吉他',
    shortName: '钢弦',
    sfzDir: `${SOUNDS}/FSS-SteelStringGuitar-SFZ-20200521/FSS-SteelStringGuitar-SFZ-20200521/`,
    sfzFile: 'FSS-SteelStringGuitar-20200521.sfz',
    license: 'GPL-3.0-or-later with FreePats special exception',
    gain: 1.0,
    pan: 0,
    effects: { overdrive: 'none', drive: 0, eq: { low: 0, mid: 0, high: 1 } },
    coreRange: [40, 76],
  },

  nylon_classical: {
    id: 'nylon_classical',
    name: '尼龙弦古典吉他',
    shortName: '尼龙',
    sfzDir: `${SOUNDS}/SpanishClassicalGuitar-SFZ-20190618/`,
    sfzFile: 'SpanishClassicalGuitar-20190618.sfz',
    license: 'CC0-1.0',
    gain: 1.05,
    pan: 0,
    effects: { overdrive: 'none', drive: 0, eq: { low: 0, mid: 0.5, high: 1 } },
    coreRange: [40, 76],
  },

  electric_clean: {
    id: 'electric_clean',
    name: '清音电吉他',
    shortName: '清音',
    sfzDir:
      `${SOUNDS}/EGuitarFSBS-clean-SFZ+WAV-20260807/` +
      'EGuitarFSBS-clean SFZ+WAV-20260807/',
    sfzFile: 'EGuitarFSBS-clean bridge 20260807.sfz',
    license: 'CC0-1.0',
    gain: 0.85,
    pan: 0,
    // 采样已经过音箱与效果器处理，不再叠加 distortion
    effects: { overdrive: 'none', drive: 0, eq: { low: -1, mid: 1, high: 1.5 } },
    coreRange: [40, 76],
  },

  electric_overdrive: {
    id: 'electric_overdrive',
    name: '失真电吉他',
    shortName: '失真',
    sfzDir:
      `${SOUNDS}/EGuitarFSBS-dist1-SFZ+WAV-20220911/` +
      'EGuitarFSBS-dist1 SFZ+WAV-20220911/',
    sfzFile: 'EGuitarFSBS-dist1 bridge 20220911.sfz',
    license: 'CC0-1.0',
    gain: 0.8,
    pan: 0,
    // 同上：样本本身已是 overdrive 音色，只做轻度 EQ
    effects: { overdrive: 'none', drive: 0, eq: { low: -2, mid: 1, high: 0.5 } },
    coreRange: [40, 76],
  },
};

export function getPreset(id: InstrumentId): InstrumentPreset {
  return INSTRUMENT_PRESETS[id];
}

/** SFZ 文件的绝对（未编码）URL 路径。 */
export function presetSfzPath(preset: InstrumentPreset): string {
  return preset.sfzDir + preset.sfzFile;
}
