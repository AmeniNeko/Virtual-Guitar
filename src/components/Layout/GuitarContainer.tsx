/**
 * GuitarContainer.tsx — 吉他指板容器
 *
 * 指板上方：变调夹选择器
 * 指板区域：可横向滚动
 */

import { useAppContext } from '../../State/AppContext';
import { FRET_COUNT_OPTIONS } from '../../Music/GuitarState';
import { Fretboard } from '../Guitar/Fretboard';
import styles from './Layout.module.css';

const CAPO_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function GuitarContainer() {
  const { state, setCapo, setFretCount } = useAppContext();

  return (
    <div className={styles.guitarContainer}>
      {/* 顶部控制：变调夹 + 品数 */}
      <div className={styles.guitarTopBar}>
        <div className={styles.capoSelector}>
          <span className={styles.capoLabel}>变调夹</span>
          <div className={styles.capoButtons}>
            {CAPO_OPTIONS.map((n) => (
              <button
                key={n}
                className={`${styles.capoBtn} ${state.capo === n ? styles.capoBtnActive : ''}`}
                onClick={() => setCapo(n)}
                aria-label={n === 0 ? '无变调夹' : `夹在第${n}品`}
              >
                {n === 0 ? '无' : n}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.fretCountSelector}>
          <span className={styles.capoLabel}>品数</span>
          <div className={styles.capoButtons}>
            {FRET_COUNT_OPTIONS.map((n) => (
              <button
                key={n}
                className={`${styles.capoBtn} ${state.fretCount === n ? styles.capoBtnActive : ''}`}
                onClick={() => setFretCount(n)}
                aria-label={`${n}品`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 指板 */}
      <div className={styles.guitarScrollArea}>
        <Fretboard />
      </div>
    </div>
  );
}
