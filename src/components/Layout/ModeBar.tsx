/**
 * ModeBar.tsx — 模式切换栏 + 模式内容面板
 *
 * 顶部：Play / Chord / Scale 三个模式按钮
 * 下方：根据当前模式显示对应内容面板
 */

import { useAppContext } from '../../State/AppContext';
import type { PlayMode } from '../../State/AppState';
import { ChordMode } from '../Modes/ChordMode';
import { ScaleMode } from '../Modes/ScaleMode';
import styles from './Layout.module.css';

const MODES: { id: PlayMode; label: string }[] = [
  { id: 'play', label: '演奏' },
  { id: 'chord', label: '和弦' },
  { id: 'scale', label: '音阶' },
];

export function ModeBar() {
  const { state, setMode, setShowNoteNames } = useAppContext();

  return (
    <div className={styles.modeBar}>
      {/* 模式切换按钮 */}
      <div className={styles.modeTabs}>
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`${styles.modeTab} ${state.mode === m.id ? styles.modeTabActive : ''}`}
            onClick={() => setMode(m.id)}
          >
            <span className={styles.modeTabLabel}>{m.label}</span>
          </button>
        ))}
      </div>

      {/* 模式内容面板 */}
      <div className={styles.modeContent}>
        {state.mode === 'chord' && <ChordMode />}
        {state.mode === 'scale' && <ScaleMode />}
        {state.mode === 'play' && (
          <div className={styles.playControls}>
            <div className={styles.toggleRow}>
              <span className={styles.toggleLabel}>指板音名</span>
              <button
                className={`${styles.toggleBtn} ${state.showNoteNames ? styles.toggleBtnActive : ''}`}
                onClick={() => setShowNoteNames(!state.showNoteNames)}
                aria-pressed={state.showNoteNames}
              >
                {state.showNoteNames ? '显示' : '不显示'}
              </button>
            </div>
            <div className={styles.playHint}>
              <span>点击指板上的音符开始演奏</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
