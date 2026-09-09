/**
 * TuningSelector.tsx — 调弦选择器
 */

import { useAppContext } from '../../State/AppContext';
import { TUNINGS } from '../../Music/Tuning';
import styles from './Controls.module.css';

export function TuningSelector() {
  const { state, setTuning } = useAppContext();

  return (
    <div className={styles.controlGroup}>
      <label className={styles.label}>调弦</label>
      <select
        className={styles.select}
        value={state.tuning}
        onChange={(e) => setTuning(e.target.value)}
      >
        {TUNINGS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
