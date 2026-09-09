/**
 * useKeyboard.ts — 键盘演奏 Hook
 *
 * 监听 keydown/keyup 事件，映射到指板位置，触发播放。
 * 处理：按键防重复、多键并发、视觉状态管理。
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { KeyboardMapper, type KeyboardNote } from './KeyboardMapper';
import { AudioEngine } from '../Audio/AudioEngine';

/** 当前按下的键信息 */
export interface ActiveKey {
  key: string;
  note: KeyboardNote;
  pressedAt: number;
}

interface UseKeyboardOptions {
  enabled: boolean;
  velocity: number;
  onNoteOn?: (note: KeyboardNote) => void;
  onNoteOff?: (key: string) => void;
}

export function useKeyboard(options: UseKeyboardOptions) {
  const { enabled, velocity, onNoteOn, onNoteOff } = options;
  const [activeKeys, setActiveKeys] = useState<Map<string, ActiveKey>>(new Map());
  const pressedKeysRef = useRef<Set<string>>(new Set());

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // 忽略重复触发
      if (e.repeat) return;

      // 忽略修饰键
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const key = e.key.toLowerCase();
      const note = KeyboardMapper.resolveKey(key);
      if (!note) return;

      // 防止默认行为（如滚动）
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }

      // 标记为按下
      pressedKeysRef.current.add(key);

      // 播放音符
      AudioEngine.playNote({
        midi: note.midi,
        velocity,
      });

      // 更新视觉状态
      setActiveKeys((prev) => {
        const next = new Map(prev);
        next.set(key, { key, note, pressedAt: Date.now() });
        return next;
      });

      onNoteOn?.(note);
    },
    [enabled, velocity, onNoteOn]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const key = e.key.toLowerCase();
      if (!pressedKeysRef.current.has(key)) return;

      pressedKeysRef.current.delete(key);

      // 更新视觉状态
      setActiveKeys((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });

      onNoteOff?.(key);
    },
    [enabled, onNoteOff]
  );

  // 窗口失焦时清除所有按键
  const handleBlur = useCallback(() => {
    pressedKeysRef.current.clear();
    setActiveKeys(new Map());
  }, []);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enabled, handleKeyDown, handleKeyUp, handleBlur]);

  return {
    activeKeys,
    isActive: (key: string) => pressedKeysRef.current.has(key.toLowerCase()),
  };
}
