/**
 * GuitarState.ts — 吉他状态模型
 *
 * 聚合吉他相关的所有状态：调弦、Capo、品数、当前选中的音符。
 * 与 AppState 对接，提供吉他专属的状态视图。
 */

import { createNote, type Note } from './Note';
import { getTuningById, getFretMidi, type TuningDefinition } from './Tuning';

/** 指板上某一格的完整数据 */
export interface FretPosition {
  /** 弦索引 (0=6弦, 5=1弦) */
  stringIdx: number;
  /** 品数 (0=空弦) */
  fret: number;
  /** 该位置的完整音符信息 */
  note: Note;
  /** 视觉坐标 x */
  x: number;
  /** 视觉坐标 y */
  y: number;
}

/** 吉他状态 */
export interface GuitarState {
  /** 当前调弦 */
  tuning: TuningDefinition;
  /** Capo 品位 */
  capo: number;
  /** 指板品数 */
  fretCount: number;
  /** 当前选中的位置（点击时更新） */
  selectedPosition: FretPosition | null;
  /** 当前指板上所有位置 */
  positions: FretPosition[];
}

/** 支持的品数选项 */
export const FRET_COUNT_OPTIONS = [12, 15, 18, 21, 22] as const;

/** 常见品位标记位置 */
export const SINGLE_DOT_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];
export const DOUBLE_DOT_FRETS = [12, 24];

/**
 * 生成指板上所有位置的数据
 * @param tuningId  调弦 ID
 * @param capo      Capo 品位
 * @param fretCount 品数
 * @param layout    布局参数（用于计算视觉坐标）
 */
export function buildFretPositions(
  tuningId: string,
  capo: number,
  fretCount: number,
  layout: { leftPad: number; topPad: number; fretWidth: number; stringGap: number }
): FretPosition[] {
  const tuning = getTuningById(tuningId);
  const positions: FretPosition[] = [];

  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= fretCount; f++) {
      const midi = getFretMidi(tuning.strings[s], f, capo);
      // 视觉反转：顶部=1弦(s=5), 底部=6弦(s=0)
      const visualRow = 5 - s;
      positions.push({
        stringIdx: s,
        fret: f,
        note: createNote(midi),
        x: layout.leftPad + (f === 0 ? -0.5 : f - 0.5) * layout.fretWidth,
        y: layout.topPad + visualRow * layout.stringGap,
      });
    }
  }

  return positions;
}

/**
 * 在 positions 中查找最近的位置
 * @param positions  所有位置
 * @param mx         鼠标 x 坐标（画布坐标系）
 * @param my         鼠标 y 坐标（画布坐标系）
 * @param maxRadius  最大匹配半径
 */
export function findNearestPosition(
  positions: FretPosition[],
  mx: number,
  my: number,
  maxRadius: number = 18
): FretPosition | null {
  let closest: FretPosition | null = null;
  let minDist = maxRadius;
  for (const pos of positions) {
    const dx = mx - pos.x;
    const dy = my - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) {
      minDist = dist;
      closest = pos;
    }
  }
  return closest;
}
