/**
 * CapoSelector.tsx — Capo 品位选择器
 */

import { useAppContext } from '../../State/AppContext';
import styles from './Controls.module.css';

export function CapoSelector() {
  const { state, setCapo } = useAppContext();

  return (
    <div className={styles.controlGroup}>
      <label className={styles.label}>Capo: {state.capo}</label>
      <input
        type="range"
        className={styles.slider}
        min={0}
        max={12}
        value={state.capo}
        onChange={(e) => setCapo(Number(e.target.value))}
      />
    </div>
  );
}
