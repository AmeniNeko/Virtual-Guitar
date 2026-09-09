/**
 * Recording.ts — 录音系统
 *
 * 基于 Note Event 的录音。
 * 记录：timestamp, duration, midi, velocity, string, fret。
 * 支持：Record, Stop, Play, Pause, Restart, Undo, Redo。
 */

// ─── NoteEvent ───────────────────────────────────────

export interface NoteEvent {
  id: string;
  /** 录音开始后的时间偏移 (ms) */
  timestamp: number;
  /** 持续时间 (ms) */
  duration: number;
  /** MIDI 编号 */
  midi: number;
  /** 力度 0-1 */
  velocity: number;
  /** 弦索引 (0=6弦, 5=1弦) */
  string: number;
  /** 品数 */
  fret: number;
}

// ─── 录音状态 ─────────────────────────────────────────

export type RecordingState = 'idle' | 'recording' | 'paused';

export type PlaybackState = 'idle' | 'playing' | 'paused';

// ─── Recorder ────────────────────────────────────────

let _eventIdCounter = 0;
function generateEventId(): string {
  return `evt_${Date.now()}_${++_eventIdCounter}`;
}

export class Recorder {
  private events: NoteEvent[] = [];
  private state: RecordingState = 'idle';
  private recordStartTime: number = 0;
  private activeNotes: Map<number, { startTime: number; stringIdx: number; fret: number; velocity: number }> = new Map();

  /** 开始录音 */
  start(): void {
    if (this.state === 'recording') return;
    this.events = [];
    this.activeNotes.clear();
    this.recordStartTime = performance.now();
    this.state = 'recording';
  }

  /** 停止录音 */
  stop(): NoteEvent[] {
    if (this.state !== 'recording') return this.events;

    // 关闭所有未结束的音符
    const now = performance.now();
    for (const [midi, active] of this.activeNotes) {
      this.events.push({
        id: generateEventId(),
        timestamp: active.startTime - this.recordStartTime,
        duration: now - active.startTime,
        midi,
        velocity: active.velocity,
        string: active.stringIdx,
        fret: active.fret,
      });
    }
    this.activeNotes.clear();
    this.state = 'idle';
    return this.events;
  }

  /** 记录 Note On */
  noteOn(midi: number, stringIdx: number, fret: number, velocity: number): void {
    if (this.state !== 'recording') return;

    // 如果同一个 MIDI 音已在播放，先关闭它
    if (this.activeNotes.has(midi)) {
      this.noteOff(midi);
    }

    this.activeNotes.set(midi, {
      startTime: performance.now(),
      stringIdx,
      fret,
      velocity,
    });
  }

  /** 记录 Note Off */
  noteOff(midi: number): void {
    if (this.state !== 'recording') return;

    const active = this.activeNotes.get(midi);
    if (!active) return;

    const now = performance.now();
    this.events.push({
      id: generateEventId(),
      timestamp: active.startTime - this.recordStartTime,
      duration: now - active.startTime,
      midi,
      velocity: active.velocity,
      string: active.stringIdx,
      fret: active.fret,
    });

    this.activeNotes.delete(midi);
  }

  /** 获取所有录制的事件 */
  getEvents(): NoteEvent[] {
    return [...this.events];
  }

  /** 设置事件列表（用于 Undo/Redo） */
  setEvents(events: NoteEvent[]): void {
    this.events = [...events];
  }

  /** 删除指定事件 */
  removeEvent(eventId: string): void {
    this.events = this.events.filter((e) => e.id !== eventId);
  }

  /** 获取录音状态 */
  getState(): RecordingState {
    return this.state;
  }

  /** 获取录音总时长 (ms) */
  getDuration(): number {
    if (this.events.length === 0) return 0;
    return Math.max(...this.events.map((e) => e.timestamp + e.duration));
  }

  /** 清空录音 */
  clear(): void {
    this.events = [];
    this.activeNotes.clear();
    this.state = 'idle';
  }
}

// ─── Playback ────────────────────────────────────────

export class PlaybackEngine {
  private events: NoteEvent[] = [];
  private state: PlaybackState = 'idle';
  private playStartTime: number = 0;
  private pauseOffset: number = 0;
  private timerIds: ReturnType<typeof setTimeout>[] = [];
  private _currentEventIndex: number = -1;
  private _onNoteOn: ((event: NoteEvent) => void) | null = null;
  private _onNoteOff: ((event: NoteEvent) => void) | null = null;
  private _onPlaybackEnd: (() => void) | null = null;
  private _onTimeUpdate: ((time: number) => void) | null = null;
  private timeUpdateInterval: ReturnType<typeof setInterval> | null = null;

  /** 设置回调 */
  onNoteOn(cb: (event: NoteEvent) => void): void { this._onNoteOn = cb; }
  onNoteOff(cb: (event: NoteEvent) => void): void { this._onNoteOff = cb; }
  onPlaybackEnd(cb: () => void): void { this._onPlaybackEnd = cb; }
  onTimeUpdate(cb: (time: number) => void): void { this._onTimeUpdate = cb; }

  /** 加载事件 */
  load(events: NoteEvent[]): void {
    this.stop();
    this.events = [...events].sort((a, b) => a.timestamp - b.timestamp);
  }

  /** 从头开始播放 */
  play(): void {
    if (this.state === 'playing') return;
    if (this.events.length === 0) return;

    if (this.state === 'paused') {
      // 从暂停位置继续
      this.resumeFrom(this.pauseOffset);
    } else {
      // 从头开始
      this.pauseOffset = 0;
      this.resumeFrom(0);
    }
  }

  private resumeFrom(offset: number): void {
    this.state = 'playing';
    this.playStartTime = performance.now() - offset;
    this._currentEventIndex = -1;

    // 安排所有事件
    this.events.forEach((event, index) => {
      const delay = event.timestamp - offset;
      if (delay < 0) return; // 已经过的事件跳过

      // Note On
      const onTimer = setTimeout(() => {
        if (this.state !== 'playing') return;
        this._currentEventIndex = index;
        this._onNoteOn?.(event);
      }, delay);
      this.timerIds.push(onTimer);

      // Note Off
      const offTimer = setTimeout(() => {
        if (this.state !== 'playing') return;
        this._onNoteOff?.(event);
      }, delay + event.duration);
      this.timerIds.push(offTimer);
    });

    // 安排结束
    const totalDuration = this.events.length > 0
      ? Math.max(...this.events.map((e) => e.timestamp + e.duration))
      : 0;
    const endTimer = setTimeout(() => {
      this.state = 'idle';
      this.stopTimeUpdate();
      this._onPlaybackEnd?.();
    }, totalDuration - offset);
    this.timerIds.push(endTimer);

    // 时间更新
    this.startTimeUpdate();
  }

  /** 暂停 */
  pause(): void {
    if (this.state !== 'playing') return;
    this.pauseOffset = performance.now() - this.playStartTime;
    this.state = 'paused';
    this.clearTimers();
    this.stopTimeUpdate();
  }

  /** 停止 */
  stop(): void {
    this.state = 'idle';
    this.pauseOffset = 0;
    this._currentEventIndex = -1;
    this.clearTimers();
    this.stopTimeUpdate();
  }

  /** 重启（从头开始） */
  restart(): void {
    this.stop();
    this.play();
  }

  private clearTimers(): void {
    this.timerIds.forEach((id) => clearTimeout(id));
    this.timerIds = [];
  }

  private startTimeUpdate(): void {
    this.stopTimeUpdate();
    this.timeUpdateInterval = setInterval(() => {
      if (this.state === 'playing') {
        const elapsed = performance.now() - this.playStartTime;
        this._onTimeUpdate?.(elapsed);
      }
    }, 50);
  }

  private stopTimeUpdate(): void {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }

  /** 获取当前播放状态 */
  getState(): PlaybackState {
    return this.state;
  }

  /** 获取当前时间偏移 (ms) */
  getCurrentTime(): number {
    if (this.state === 'playing') {
      return performance.now() - this.playStartTime;
    }
    return this.pauseOffset;
  }

  /** 获取当前事件索引 */
  getCurrentEventIndex(): number {
    return this._currentEventIndex;
  }

  /** 跳转到指定时间 */
  seek(timeMs: number): void {
    const wasPlaying = this.state === 'playing';
    this.clearTimers();
    this.stopTimeUpdate();
    this.pauseOffset = timeMs;
    if (wasPlaying) {
      this.resumeFrom(timeMs);
    }
  }

  /** 销毁 */
  destroy(): void {
    this.clearTimers();
    this.stopTimeUpdate();
  }
}

// ─── Undo/Redo ───────────────────────────────────────

export class UndoRedoManager {
  private undoStack: NoteEvent[][] = [];
  private redoStack: NoteEvent[][] = [];
  private maxHistory: number = 50;

  /** 记录当前状态（在操作前调用） */
  pushState(events: NoteEvent[]): void {
    this.undoStack.push([...events]);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    // 新操作清空 redo 栈
    this.redoStack = [];
  }

  /** 撤销 */
  undo(currentEvents: NoteEvent[]): NoteEvent[] | null {
    if (this.undoStack.length === 0) return null;
    this.redoStack.push([...currentEvents]);
    return this.undoStack.pop()!;
  }

  /** 重做 */
  redo(currentEvents: NoteEvent[]): NoteEvent[] | null {
    if (this.redoStack.length === 0) return null;
    this.undoStack.push([...currentEvents]);
    return this.redoStack.pop()!;
  }

  /** 是否可以撤销 */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** 是否可以重做 */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** 清空历史 */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

// ─── 全局单例 ────────────────────────────────────────

/** 全局录音器 */
export const GlobalRecorder = new Recorder();

/** 全局回放引擎 */
export const GlobalPlayback = new PlaybackEngine();

/** 全局 Undo/Redo 管理器 */
export const GlobalUndoRedo = new UndoRedoManager();
