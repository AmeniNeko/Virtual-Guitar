/**
 * StatusPanel.tsx — 底部状态栏
 *
 * 显示当前调弦、Capo、品数等状态信息。
 */

import { useAppContext } from '../../State/AppContext';
import { getTuningById } from '../../Music/Tuning';
import styles from './Layout.module.css';

export function StatusPanel() {
  const { state } = useAppContext();
  const tuning = getTuningById(state.tuning);

  return (
    <footer className={styles.statusPanel}>
      <div className={styles.statusItems}>
        <span className={styles.statusItem}>
          <span className={styles.statusLabel}>调弦</span>
          <span className={styles.statusValue}>{tuning.name}</span>
        </span>
        <span className={styles.statusDivider}>|</span>
        <span className={styles.statusItem}>
          <span className={styles.statusLabel}>Capo</span>
          <span className={styles.statusValue}>{state.capo}</span>
        </span>
        <span className={styles.statusDivider}>|</span>
        <span className={styles.statusItem}>
          <span className={styles.statusLabel}>品数</span>
          <span className={styles.statusValue}>{state.fretCount}</span>
        </span>
        <span className={styles.statusDivider}>|</span>
        <span className={styles.statusItem}>
          <span className={styles.statusLabel}>模式</span>
          <span className={styles.statusValue}>
            {state.mode === 'play' ? '演奏' : state.mode === 'chord' ? '和弦' : '音阶'}
          </span>
        </span>
      </div>
    </footer>
  );
}
