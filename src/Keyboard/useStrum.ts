/**
 * useStrum.ts — 扫弦检测 Hook
 *
 * 检测鼠标拖动 / 触摸滑动穿过琴弦的行为。
 * 判断扫弦方向（下扫/上扫）和速度。
 */

import { useCallback, useRef, useState } from 'react';

export interface StrumEvent {
  direction: 'down' | 'up';
  /** 穿过的弦索引列表 (0=6弦, 5=1弦) */
  stringsCrossed: number[];
  /** 扫弦速度 (越小越快) */
  speed: number;
}

interface UseStrumOptions {
  /** 弦的 Y 坐标数组（6个值，从 6 弦到 1 弦） */
  stringYPositions: number[];
  /** 扫弦检测的 Y 容差 */
  yTolerance?: number;
  /** 最大扫弦时间 (ms) */
  maxDuration?: number;
  onStrum: (event: StrumEvent) => void;
}

export function useStrum(options: UseStrumOptions) {
  const {
    stringYPositions,
    yTolerance = 12,
    maxDuration = 500,
    onStrum,
  } = options;

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const crossedStringsRef = useRef<Set<number>>(new Set());

  /** 根据 Y 坐标判断最接近的弦 */
  const findStringAtY = useCallback(
    (y: number): number | null => {
      let closest = -1;
      let minDist = yTolerance;
      for (let s = 0; s < stringYPositions.length; s++) {
        const dist = Math.abs(y - stringYPositions[s]);
        if (dist < minDist) {
          minDist = dist;
          closest = s;
        }
      }
      return closest >= 0 ? closest : null;
    },
    [stringYPositions, yTolerance]
  );

  /** 检测扫弦并触发 */
  const checkStrum = useCallback(
    (currentY: number) => {
      const str = findStringAtY(currentY);
      if (str !== null) {
        crossedStringsRef.current.add(str);
      }
    },
    [findStringAtY]
  );

  const handlePointerDown = useCallback(
    (clientX: number, clientY: number, canvasRect: DOMRect, scaleY: number) => {
      const my = (clientY - canvasRect.top) * scaleY;
      const str = findStringAtY(my);
      if (str === null) return;

      setIsDragging(true);
      dragStartRef.current = { x: clientX, y: clientY, time: Date.now() };
      crossedStringsRef.current = new Set([str]);
    },
    [findStringAtY]
  );

  const handlePointerMove = useCallback(
    (clientY: number, canvasRect: DOMRect, scaleY: number) => {
      if (!isDragging) return;
      const my = (clientY - canvasRect.top) * scaleY;
      checkStrum(my);
    },
    [isDragging, checkStrum]
  );

  const handlePointerUp = useCallback(
    (clientY: number, canvasRect: DOMRect, scaleY: number) => {
      if (!isDragging || !dragStartRef.current) {
        setIsDragging(false);
        return;
      }

      const my = (clientY - canvasRect.top) * scaleY;
      checkStrum(my);

      const start = dragStartRef.current;
      const duration = Date.now() - start.time;
      const deltaY = clientY - start.y;
      const crossed = Array.from(crossedStringsRef.current).sort((a, b) => a - b);

      // 只有穿过了至少 2 根弦才算扫弦
      if (crossed.length >= 2 && duration <= maxDuration) {
        const direction: 'down' | 'up' = deltaY > 0 ? 'down' : 'up';
        onStrum({
          direction,
          stringsCrossed: crossed,
          speed: duration,
        });
      }

      setIsDragging(false);
      dragStartRef.current = null;
      crossedStringsRef.current = new Set();
    },
    [isDragging, checkStrum, maxDuration, onStrum]
  );

  return {
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
