/**
 * Timeline.tsx — 录音时间轴
 *
 * 显示录制的 Note Event，支持点击删除。
 * 使用 Canvas 绘制时间轴和事件块。
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import type { NoteEvent } from './Recording';
import { midiToNoteName } from '../Music/Note';
import styles from './Recording.module.css';

interface TimelineProps {
  events: NoteEvent[];
  currentTime: number;
  isPlaying: boolean;
  onDeleteEvent: (eventId: string) => void;
  onSeek: (timeMs: number) => void;
}

const LAYOUT = {
  height: 80,
  trackHeight: 20,
  trackGap: 4,
  leftPad: 40,
  rightPad: 20,
  pixelsPerMs: 0.05, // 50px per second
};

/** 弦的颜色 */
const STRING_COLORS = [
  '#e94560', '#ff6b6b', '#ffa502', '#2ed573', '#1e90ff', '#a55eea',
];

export function Timeline({ events, currentTime, isPlaying, onDeleteEvent, onSeek }: TimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);

  const totalDuration = events.length > 0
    ? Math.max(...events.map((e) => e.timestamp + e.duration)) + 1000
    : 5000;

  const canvasWidth = Math.max(
    LAYOUT.leftPad + totalDuration * LAYOUT.pixelsPerMs + LAYOUT.rightPad,
    400
  );

  // 查找鼠标位置对应的事件
  const getEventAtPosition = useCallback(
    (mx: number, my: number): NoteEvent | null => {
      const scale = LAYOUT.pixelsPerMs;
      for (const event of events) {
        const x = LAYOUT.leftPad + event.timestamp * scale;
        const w = Math.max(event.duration * scale, 4);
        const trackIdx = event.string;
        const y = 10 + trackIdx * (LAYOUT.trackHeight + LAYOUT.trackGap);

        if (mx >= x && mx <= x + w && my >= y && my <= y + LAYOUT.trackHeight) {
          return event;
        }
      }
      return null;
    },
    [events]
  );

  // 绘制时间轴
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvasWidth;
    const H = LAYOUT.height;

    if (canvas.width !== W * devicePixelRatio || canvas.height !== H * devicePixelRatio) {
      canvas.width = W * devicePixelRatio;
      canvas.height = H * devicePixelRatio;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.scale(devicePixelRatio, devicePixelRatio);
    } else {
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }

    ctx.clearRect(0, 0, W, H);

    // 背景
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    const scale = LAYOUT.pixelsPerMs;

    // 时间刻度
    ctx.fillStyle = '#333';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    const stepMs = 1000; // 每秒一个刻度
    for (let t = 0; t <= totalDuration; t += stepMs) {
      const x = LAYOUT.leftPad + t * scale;
      ctx.fillStyle = '#333';
      ctx.fillRect(x, 0, 1, H);

      ctx.fillStyle = '#555';
      ctx.fillText(`${(t / 1000).toFixed(1)}s`, x, H - 2);
    }

    // 6条轨道线
    for (let s = 0; s < 6; s++) {
      const y = 10 + s * (LAYOUT.trackHeight + LAYOUT.trackGap);
      ctx.fillStyle = '#161b22';
      ctx.fillRect(LAYOUT.leftPad, y, W - LAYOUT.leftPad - LAYOUT.rightPad, LAYOUT.trackHeight);

      // 弦号
      ctx.fillStyle = '#555';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${6 - s}`, LAYOUT.leftPad - 6, y + LAYOUT.trackHeight / 2 + 3);
    }

    // 事件块
    for (const event of events) {
      const x = LAYOUT.leftPad + event.timestamp * scale;
      const w = Math.max(event.duration * scale, 4);
      const trackIdx = event.string;
      const y = 10 + trackIdx * (LAYOUT.trackHeight + LAYOUT.trackGap);

      const isHovered = hoveredEvent === event.id;
      const color = STRING_COLORS[trackIdx] || '#e94560';

      // 事件块
      ctx.fillStyle = isHovered ? color : `${color}99`;
      ctx.fillRect(x, y + 2, w, LAYOUT.trackHeight - 4);

      // 边框
      ctx.strokeStyle = color;
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.strokeRect(x, y + 2, w, LAYOUT.trackHeight - 4);

      // 音符名
      if (w > 20) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(midiToNoteName(event.midi), x + w / 2, y + LAYOUT.trackHeight / 2);
        ctx.textBaseline = 'alphabetic';
      }
    }

    // 播放头
    if (isPlaying || currentTime > 0) {
      const playheadX = LAYOUT.leftPad + currentTime * scale;
      ctx.strokeStyle = '#e94560';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, H);
      ctx.stroke();

      // 播放头三角
      ctx.fillStyle = '#e94560';
      ctx.beginPath();
      ctx.moveTo(playheadX - 4, 0);
      ctx.lineTo(playheadX + 4, 0);
      ctx.lineTo(playheadX, 6);
      ctx.closePath();
      ctx.fill();
    }
  }, [events, currentTime, isPlaying, hoveredEvent, canvasWidth, totalDuration]);

  useEffect(() => {
    draw();
  }, [draw]);

  // 鼠标事件
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvasWidth / rect.width;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = e.clientY - rect.top;
      const event = getEventAtPosition(mx, my);
      setHoveredEvent(event?.id ?? null);
    },
    [getEventAtPosition, canvasWidth]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvasWidth / rect.width;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = e.clientY - rect.top;

      // 右键或 Shift+Click 删除
      if (e.shiftKey || e.button === 2) {
        const event = getEventAtPosition(mx, my);
        if (event) {
          onDeleteEvent(event.id);
        }
        return;
      }

      // 普通点击：跳转
      const timeMs = (mx - LAYOUT.leftPad) / LAYOUT.pixelsPerMs;
      if (timeMs >= 0) {
        onSeek(Math.max(0, timeMs));
      }
    },
    [getEventAtPosition, onDeleteEvent, onSeek, canvasWidth]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = e.clientY - rect.top;
    const event = getEventAtPosition(mx, my);
    if (event) {
      onDeleteEvent(event.id);
    }
  }, [getEventAtPosition, onDeleteEvent, canvasWidth]);

  return (
    <div ref={containerRef} className={styles.timelineContainer}>
      <canvas
        ref={canvasRef}
        className={styles.timelineCanvas}
        style={{ width: canvasWidth, height: LAYOUT.height }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />
    </div>
  );
}
