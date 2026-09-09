/**
 * ModeSelector.tsx — 模式选择器
 *
 * Play / Chord / Scale 三种模式切换。
 */

import { useAppContext } from '../../State/AppContext';
import type { PlayMode } from '../../State/AppState';
import styles from './Controls.module.css';

const MODES: { id: PlayMode; label: string }[] = [
  { id: 'play', label: '演奏' },
  { id: 'chord', label: '和弦' },
  { id: 'scale', label: '音阶' },
];

export function ModeSelector() {
  const { state, setMode } = useAppContext();

  return (
    <div className={styles.controlGroup}>
      <label className={styles.label}>模式</label>
      <div className={styles.modeButtons}>
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`${styles.modeBtn} ${state.mode === m.id ? styles.modeBtnActive : ''}`}
            onClick={() => setMode(m.id)}
          >
            <span>{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
