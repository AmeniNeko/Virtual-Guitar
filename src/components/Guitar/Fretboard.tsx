/**
 * Fretboard.tsx — 吉他指板（重构版）
 *
 * 交互逻辑：
 * - Hover：鼠标悬停时显示半透明圆（仅无按钮按下时）
 * - Click：左键按下时触发音符 + 显示圆+音名特效
 * - Drag：左键按下移动，每进入新格子触发一次
 * - 松开左键：特效消失
 */

import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useAppContext } from '../../State/AppContext';
import { midiToNoteName, noteToIndex } from '../../Music/Note';
import { getScaleSemitones, SCALE_TYPES } from '../../Music/Scale';
import {
  buildFretPositions,
  findNearestPosition,
  SINGLE_DOT_FRETS,
  DOUBLE_DOT_FRETS,
  type FretPosition,
} from '../../Music/GuitarState';
import { getTuningById } from '../../Music/Tuning';
import { AudioEngine } from '../../Audio/AudioEngine';
import { GlobalRecorder } from '../../Recording/Recording';
import { KeyboardMapper } from '../../Keyboard/KeyboardMapper';
import { useKeyboard } from '../../Keyboard/useKeyboard';
import { useStrum, type StrumEvent } from '../../Keyboard/useStrum';
import { findChordFingering } from '../../data/chords';
import { getChordNotes } from '../../Music/Chord';
import styles from './Fretboard.module.css';

// ─── 布局 ────────────────────────────────────────────
const L = {
  leftPad: 52, topPad: 40, rightPad: 24, bottomPad: 28,
  fretWidth: 58, stringGap: 44,
};

// ─── 点击特效状态 ─────────────────────────────────────
interface ClickFX {
  x: number;
  y: number;
  note: string;
  on: boolean;
}

// ─── 组件 ────────────────────────────────────────────
export function Fretboard() {
  const { state } = useAppContext();
  const cvsRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [hoverCell, setHoverCell] = useState<FretPosition | null>(null);
  const downRef = useRef(false);
  const playedRef = useRef<Set<string>>(new Set());
  const fxRef = useRef<ClickFX>({ x: 0, y: 0, note: '', on: false });
  const redrawRef = useRef(false);

  const tuning = getTuningById(state.tuning);
  const {
    fretCount, capo, mode, selectedChordType, selectedScaleType,
    rootNote, velocity, selectedGroup,
  } = state;

  useEffect(() => { KeyboardMapper.setTuning(state.tuning); }, [state.tuning]);
  useEffect(() => { KeyboardMapper.setCapo(state.capo); }, [state.capo]);

  const positions = useMemo(
    () => buildFretPositions(state.tuning, capo, fretCount, L),
    [state.tuning, capo, fretCount],
  );

  // 高亮集
  const hlSet = useMemo<Set<number>>(() => {
    const s = new Set<number>();
    if (mode === 'chord' && selectedChordType && rootNote) {
      const cf = findChordFingering(rootNote, selectedChordType);
      if (cf) {
        const lo: number[] = [], md: number[] = [], hi: number[] = [];
        for (let i = 0; i < 6; i++) {
          const f = cf.frets[i];
          if (f !== null && f >= 0) (f <= 3 ? lo : f <= 7 ? md : hi).push(i);
        }
        const gs = [lo, md, hi].filter((g) => g.length > 0);
        if (gs.length <= 1) {
          const ns = getChordNotes(rootNote, cf.type).map(noteToIndex);
          const si = new Set(ns);
          positions.forEach((p) => { if (si.has(noteToIndex(p.note.name))) s.add(p.note.midi); });
        } else {
          const ag = gs[selectedGroup] ?? gs[0];
          const t = getTuningById(state.tuning);
          ag.forEach((i) => {
            const f = cf.frets[i];
            if (f !== null && f >= 0) s.add(t.strings[i] + f + capo);
          });
        }
      }
    } else if (mode === 'scale' && selectedScaleType && rootNote) {
      const st = SCALE_TYPES.find((x) => x.id === selectedScaleType);
      if (st) {
        const ss = new Set(getScaleSemitones(rootNote, st));
        positions.forEach((p) => { if (ss.has(noteToIndex(p.note.name))) s.add(p.note.midi); });
      }
    }
    return s;
  }, [mode, selectedChordType, selectedScaleType, rootNote, positions, state.tuning, capo, selectedGroup]);

  // 键盘
  const { activeKeys } = useKeyboard({
    enabled: true, velocity,
    onNoteOn: () => { if (navigator.vibrate) navigator.vibrate(10); },
  });

  // 扫弦
  const handleStrum = useCallback((ev: StrumEvent) => {
    const dir = ev.direction === 'down'
      ? [...ev.stringsCrossed].sort((a, b) => b - a)
      : [...ev.stringsCrossed].sort((a, b) => a - b);
    const delay = Math.max(10, Math.min(80, ev.speed / dir.length));
    dir.forEach((s, i) => {
      const d = i * delay + (state.humanize ? (Math.random() - 0.5) * 10 : 0);
      const v = state.humanize ? velocity * (0.85 + Math.random() * 0.3) : velocity;
      const m = tuning.strings[s] + capo;
      setTimeout(() => { AudioEngine.playNote({ midi: m, velocity: v }); GlobalRecorder.noteOn(m, s, 0, v); }, Math.max(0, d));
    });
  }, [state.tuning, capo, state.humanize, velocity, tuning]);

  const { handlePointerDown, handlePointerMove, handlePointerUp } = useStrum({
    stringYPositions: Array.from({ length: 6 }, (_, s) => L.topPad + s * L.stringGap),
    yTolerance: 14, maxDuration: 400, onStrum: handleStrum,
  });

  const getPos = useCallback(
    (mx: number, my: number): FretPosition | null => findNearestPosition(positions, mx, my),
    [positions],
  );

  const getCoords = useCallback((cx: number, cy: number) => {
    const c = cvsRef.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { mx: (cx - r.left) * (parseFloat(c.style.width) / r.width), my: (cy - r.top) * (parseFloat(c.style.height) / r.height) };
  }, []);

  // 触发音符 + 显示特效
  const triggerNote = useCallback((pos: FretPosition) => {
    const v = state.humanize ? velocity * (0.85 + Math.random() * 0.3) : velocity;
    AudioEngine.playNote({ midi: pos.note.midi, velocity: v });
    GlobalRecorder.noteOn(pos.note.midi, pos.stringIdx, pos.fret, v);
    fxRef.current = { x: pos.x, y: pos.y, note: pos.note.name + pos.note.octave, on: true };
    redrawRef.current = true;
  }, [state.humanize, velocity]);

  // 隐藏特效
  const hideFx = useCallback(() => {
    fxRef.current.on = false;
    redrawRef.current = true;
  }, []);

  // ── 鼠标事件 ──

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const co = getCoords(e.clientX, e.clientY);
    if (!co) return;
    const pos = getPos(co.mx, co.my);
    setHoverCell(pos);

    if (downRef.current && pos) {
      const key = `${pos.stringIdx}-${pos.fret}`;
      if (!playedRef.current.has(key)) {
        playedRef.current.add(key);
        triggerNote(pos);
      }
    }
    handlePointerMove(e.clientY, e.currentTarget.getBoundingClientRect(), 1);
  }, [getCoords, getPos, triggerNote, handlePointerMove]);

  const handleMouseLeave = useCallback(() => {
    setHoverCell(null);
    downRef.current = false;
    playedRef.current.clear();
    hideFx();
  }, [hideFx]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    downRef.current = true;
    playedRef.current.clear();
    handlePointerDown(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), 1);
    const co = getCoords(e.clientX, e.clientY);
    if (co) {
      const pos = getPos(co.mx, co.my);
      if (pos) {
        playedRef.current.add(`${pos.stringIdx}-${pos.fret}`);
        triggerNote(pos);
      }
    }
  }, [handlePointerDown, getCoords, getPos, triggerNote]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    downRef.current = false;
    playedRef.current.clear();
    hideFx();
    handlePointerUp(e.clientY, e.currentTarget.getBoundingClientRect(), 1);
  }, [hideFx, handlePointerUp]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // 点击逻辑已由 mousedown/mouseup 处理，此处无需操作
    void e;
  }, []);

  // Touch
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    if (!t) return;
    const c = cvsRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    handlePointerDown(t.clientX, t.clientY, r, parseFloat(c.style.height) / r.height);
    const co = getCoords(t.clientX, t.clientY);
    if (co) {
      const pos = getPos(co.mx, co.my);
      if (pos) { playedRef.current.add(`${pos.stringIdx}-${pos.fret}`); triggerNote(pos); }
    }
  }, [handlePointerDown, getCoords, getPos, triggerNote]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    if (!t) return;
    const c = cvsRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    handlePointerMove(t.clientY, r, parseFloat(c.style.height) / r.height);
  }, [handlePointerMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (!t) return;
    const c = cvsRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    handlePointerUp(t.clientY, r, parseFloat(c.style.height) / r.height);
    hideFx();
  }, [handlePointerUp, hideFx]);

  // 键盘回调
  const getKbPos = useCallback((key: string) => {
    const m = KeyboardMapper.resolveKey(key);
    return m ? positions.find((p) => p.stringIdx === m.stringIdx && p.fret === m.fret) ?? null : null;
  }, [positions]);

  // ── 绘制 ──
  const draw = useCallback(() => {
    const cvs = cvsRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const W = L.leftPad + L.fretWidth * fretCount + L.rightPad;
    const H = L.topPad + L.stringGap * 5 + L.bottomPad;

    if (cvs.width !== W * devicePixelRatio || cvs.height !== H * devicePixelRatio) {
      cvs.width = W * devicePixelRatio;
      cvs.height = H * devicePixelRatio;
      cvs.style.width = `${W}px`;
      cvs.style.height = `${H}px`;
      ctx.scale(devicePixelRatio, devicePixelRatio);
    } else {
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }
    ctx.clearRect(0, 0, W, H);

    // 背景
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(L.leftPad - 10, L.topPad - 20, L.fretWidth * fretCount + 20, L.stringGap * 5 + 40);
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
    ctx.strokeRect(L.leftPad - 10, L.topPad - 20, L.fretWidth * fretCount + 20, L.stringGap * 5 + 40);

    // 品丝
    for (let f = 0; f <= fretCount; f++) {
      const x = L.leftPad + f * L.fretWidth;
      ctx.strokeStyle = f === 0 ? '#444' : '#222'; ctx.lineWidth = f === 0 ? 2.5 : 1;
      ctx.beginPath(); ctx.moveTo(x, L.topPad - 16); ctx.lineTo(x, L.topPad + L.stringGap * 5 + 16); ctx.stroke();
    }

    // Capo
    if (capo > 0 && capo <= fretCount) {
      const x = L.leftPad + (capo - 0.5) * L.fretWidth;
      ctx.strokeStyle = '#7EBCF5'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
      ctx.beginPath(); ctx.moveTo(x, L.topPad - 14); ctx.lineTo(x, L.topPad + L.stringGap * 5 + 14); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#7EBCF5'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('CAPO', x, L.topPad - 20);
    }

    // 品位标记
    ctx.fillStyle = 'rgba(126, 188, 245, 0.1)';
    for (const f of SINGLE_DOT_FRETS) {
      if (f > fretCount) continue;
      ctx.beginPath(); ctx.arc(L.leftPad + (f - 0.5) * L.fretWidth, L.topPad + L.stringGap * 2.5, 4, 0, Math.PI * 2); ctx.fill();
    }
    for (const f of DOUBLE_DOT_FRETS) {
      if (f > fretCount) continue;
      const x = L.leftPad + (f - 0.5) * L.fretWidth;
      ctx.beginPath(); ctx.arc(x, L.topPad + L.stringGap * 1.5, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, L.topPad + L.stringGap * 3.5, 4, 0, Math.PI * 2); ctx.fill();
    }

    // 弦（顶部=1弦最细，底部=6弦最粗）
    for (let row = 0; row < 6; row++) {
      const y = L.topPad + row * L.stringGap;
      const si = 5 - row;
      ctx.strokeStyle = '#555'; ctx.lineWidth = 1.0 + row * 0.45;
      ctx.beginPath(); ctx.moveTo(L.leftPad, y); ctx.lineTo(L.leftPad + fretCount * L.fretWidth, y); ctx.stroke();
      ctx.fillStyle = '#7EBCF5'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'right';
      ctx.fillText(midiToNoteName(tuning.strings[si]), L.leftPad - 10, y + 4);
    }

    // 品号
    ctx.fillStyle = '#444'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
    for (let f = 1; f <= fretCount; f++) {
      ctx.fillText(String(f), L.leftPad + (f - 0.5) * L.fretWidth, L.topPad + L.stringGap * 5 + 20);
    }

    // 键盘高亮
    for (const [, ak] of activeKeys) {
      const p = getKbPos(ak.key);
      if (!p) continue;
      ctx.shadowColor = 'rgba(126,188,245,0.7)'; ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(126,188,245,0.3)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#7EBCF5'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ak.note.noteName, p.x, p.y);
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#7EBCF5'; ctx.font = 'bold 7px sans-serif';
      ctx.fillText(ak.key.toUpperCase(), p.x, p.y + 18);
    }

    // Hover 圆（无按钮按下时）
    if (hoverCell && !downRef.current && !activeKeys.size) {
      ctx.fillStyle = 'rgba(126,188,245,0.12)';
      ctx.beginPath(); ctx.arc(hoverCell.x, hoverCell.y, 14, 0, Math.PI * 2); ctx.fill();
    }

    // 点击/拖动特效（圆 + 音名，左键按下期间显示）
    const fx = fxRef.current;
    if (fx.on) {
      ctx.fillStyle = 'rgba(126,188,245,0.15)';
      ctx.beginPath(); ctx.arc(fx.x, fx.y, 14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(126,188,245,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#7EBCF5'; ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(fx.note, fx.x, fx.y);
      ctx.textBaseline = 'alphabetic';
    }

    // 和弦/音阶高亮
    if (hlSet.size > 0) {
      for (const p of positions) {
        if (!hlSet.has(p.note.midi)) continue;
        if (p.fret === 0) {
          ctx.strokeStyle = '#7EBCF5'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.stroke();
        } else {
          ctx.shadowColor = 'rgba(126,188,245,0.6)'; ctx.shadowBlur = 8;
          ctx.fillStyle = '#7EBCF5';
          ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#000'; ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(p.note.name, p.x, p.y);
          ctx.textBaseline = 'alphabetic';
        }
      }
    } else if (!activeKeys.size) {
      if (state.showNoteNames) {
        for (const p of positions) {
          if (p.fret === 0) continue;
          // 填充圆（与点击特效同色同大小，无描边）
          ctx.fillStyle = 'rgba(126,188,245,0.15)';
          ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); ctx.fill();
          // 音名（与点击特效同色同字号）
          ctx.fillStyle = '#7EBCF5';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(p.note.name + p.note.octave, p.x, p.y);
          ctx.textBaseline = 'alphabetic';
        }
      }
    }
  }, [positions, hlSet, hoverCell, activeKeys, getKbPos, fretCount, capo, tuning, state.showNoteNames]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const c = wrapRef.current;
    if (!c) return;
    const o = new ResizeObserver(() => draw());
    o.observe(c);
    return () => o.disconnect();
  }, [draw]);

  // 重绘循环：消费 redrawRef 标记
  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (!alive) return;
      if (redrawRef.current) {
        redrawRef.current = false;
        draw();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { alive = false; };
  }, [draw]);

  const W = L.leftPad + L.fretWidth * fretCount + L.rightPad;
  const H = L.topPad + L.stringGap * 5 + L.bottomPad;

  return (
    <div ref={wrapRef} className={styles.container}>
      <canvas
        ref={cvsRef}
        className={styles.canvas}
        style={{ width: W, height: H }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  );
}
