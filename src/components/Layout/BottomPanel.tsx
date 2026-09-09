/**
 * BottomPanel.tsx — 底部操作面板
 *
 * Phase 07：MIDI 导出 + 完整录音系统。
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../../State/AppContext';
import {
  GlobalRecorder,
  GlobalPlayback,
  GlobalUndoRedo,
  type NoteEvent,
  type PlaybackState,
} from '../../Recording/Recording';
import { Timeline } from '../../Recording/Timeline';
import { AudioEngine } from '../../Audio/AudioEngine';
import { downloadMidi } from '../../Midi/MidiWriter';
import styles from './Layout.module.css';

export function BottomPanel() {
  const { state, setIsRecording } = useAppContext();
  const [events, setEvents] = useState<NoteEvent[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 录音时间更新
  useEffect(() => {
    if (state.isRecording) {
      recordingTimerRef.current = setInterval(() => {
        const rec = GlobalRecorder as unknown as { recordStartTime: number };
        setRecordingTime(performance.now() - rec.recordStartTime);
      }, 50);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [state.isRecording]);

  // Playback 回调
  useEffect(() => {
    GlobalPlayback.onNoteOn((event: NoteEvent) => {
      AudioEngine.playNote({
        midi: event.midi,
        velocity: event.velocity,
        duration: event.duration / 1000,
      });
    });
    GlobalPlayback.onNoteOff(() => {});
    GlobalPlayback.onPlaybackEnd(() => {
      setPlaybackState('idle');
      setCurrentTime(0);
    });
    GlobalPlayback.onTimeUpdate((time: number) => {
      setCurrentTime(time);
    });

    return () => GlobalPlayback.destroy();
  }, []);

  // Undo/Redo 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          const current = GlobalRecorder.getEvents();
          const restored = GlobalUndoRedo.redo(current);
          if (restored) {
            GlobalRecorder.setEvents(restored);
            setEvents([...restored]);
            GlobalPlayback.load(restored);
          }
        } else {
          const current = GlobalRecorder.getEvents();
          const restored = GlobalUndoRedo.undo(current);
          if (restored) {
            GlobalRecorder.setEvents(restored);
            setEvents([...restored]);
            GlobalPlayback.load(restored);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 录音控制
  const handleRecordToggle = useCallback(() => {
    if (state.isRecording) {
      const recordedEvents = GlobalRecorder.stop();
      setIsRecording(false);
      setEvents([...recordedEvents]);
      GlobalPlayback.load(recordedEvents);
      setRecordingTime(0);
    } else {
      GlobalUndoRedo.pushState(GlobalRecorder.getEvents());
      GlobalRecorder.start();
      setIsRecording(true);
      setEvents([]);
      GlobalPlayback.stop();
      setCurrentTime(0);
    }
  }, [state.isRecording, setIsRecording]);

  // 播放控制
  const handlePlay = useCallback(() => {
    if (playbackState === 'playing') {
      GlobalPlayback.pause();
      setPlaybackState('paused');
    } else {
      GlobalPlayback.play();
      setPlaybackState('playing');
    }
  }, [playbackState]);

  const handleStop = useCallback(() => {
    GlobalPlayback.stop();
    setPlaybackState('idle');
    setCurrentTime(0);
  }, []);

  const handleRestart = useCallback(() => {
    GlobalPlayback.restart();
    setPlaybackState('playing');
  }, []);

  // 删除事件
  const handleDeleteEvent = useCallback((eventId: string) => {
    GlobalUndoRedo.pushState(GlobalRecorder.getEvents());
    GlobalRecorder.removeEvent(eventId);
    const updated = GlobalRecorder.getEvents();
    setEvents([...updated]);
    GlobalPlayback.load(updated);
  }, []);

  // 跳转
  const handleSeek = useCallback((timeMs: number) => {
    GlobalPlayback.seek(timeMs);
    setCurrentTime(timeMs);
  }, []);

  // 清空
  const handleClear = useCallback(() => {
    GlobalUndoRedo.pushState(GlobalRecorder.getEvents());
    GlobalRecorder.clear();
    GlobalPlayback.stop();
    setEvents([]);
    setCurrentTime(0);
    setPlaybackState('idle');
  }, []);

  // MIDI 导出
  const handleExportMidi = useCallback(() => {
    if (events.length === 0) return;
    downloadMidi({ events, bpm: 120 }, `virtual-guitar-${Date.now()}.mid`);
  }, [events]);

  const isRecording = state.isRecording;
  const hasEvents = events.length > 0;

  return (
    <div className={styles.bottomPanel}>
      <div className={styles.bottomActions}>
        <button
          className={`${styles.actionBtn} ${styles.recordBtn} ${isRecording ? styles.recording : ''}`}
          onClick={handleRecordToggle}
        >
          <span className={styles.recordDot} />
          {isRecording ? '停止' : '录音'}
        </button>

        <button
          className={`${styles.actionBtn} ${styles.playbackBtn}`}
          onClick={handlePlay}
          disabled={!hasEvents && playbackState === 'idle'}
        >
          {playbackState === 'playing' ? '暂停' : '播放'}
        </button>

        <button
          className={styles.actionBtn}
          onClick={handleStop}
          disabled={playbackState === 'idle'}
        >
          停止
        </button>

        <button
          className={styles.actionBtn}
          onClick={handleRestart}
          disabled={!hasEvents}
        >
          重启
        </button>

        <button
          className={`${styles.actionBtn} ${styles.clearBtn}`}
          onClick={handleClear}
          disabled={!hasEvents}
        >
          清空
        </button>

        <button
          className={`${styles.actionBtn} ${styles.exportBtn}`}
          onClick={handleExportMidi}
          disabled={!hasEvents}
        >
          导出 MIDI
        </button>

        <button
          className={styles.actionBtn}
          onClick={() => {
            const current = GlobalRecorder.getEvents();
            const restored = GlobalUndoRedo.undo(current);
            if (restored) {
              GlobalRecorder.setEvents(restored);
              setEvents([...restored]);
              GlobalPlayback.load(restored);
            }
          }}
          disabled={!GlobalUndoRedo.canUndo()}
          title="撤销 (Ctrl+Z)"
        >
          ↩
        </button>

        <button
          className={styles.actionBtn}
          onClick={() => {
            const current = GlobalRecorder.getEvents();
            const restored = GlobalUndoRedo.redo(current);
            if (restored) {
              GlobalRecorder.setEvents(restored);
              setEvents([...restored]);
              GlobalPlayback.load(restored);
            }
          }}
          disabled={!GlobalUndoRedo.canRedo()}
          title="重做 (Ctrl+Shift+Z)"
        >
          ↪
        </button>
      </div>

      <div className={styles.bottomInfo}>
        {isRecording && (
          <span className={styles.recordingIndicator}>
            <span className={styles.recordingPulse} />
            REC {(recordingTime / 1000).toFixed(1)}s
          </span>
        )}
        {playbackState !== 'idle' && (
          <span className={styles.playbackInfo}>
            {playbackState === 'playing' ? '>' : '||'} {(currentTime / 1000).toFixed(1)}s
          </span>
        )}
        <span className={styles.eventCount}>
          {events.length} events
        </span>
      </div>

      {hasEvents && (
        <div className={styles.timelineWrapper}>
          <Timeline
            events={events}
            currentTime={currentTime}
            isPlaying={playbackState === 'playing'}
            onDeleteEvent={handleDeleteEvent}
            onSeek={handleSeek}
          />
        </div>
      )}
    </div>
  );
}
