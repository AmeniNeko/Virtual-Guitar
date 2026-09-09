/**
 * InstrumentSelector.tsx — 乐器选择器
 *
 * 四个音色：钢弦木吉他、尼龙弦古典吉他、清音电吉他、失真电吉他。
 * 列表直接由 Audio Engine 的 preset 驱动，避免 UI 与引擎各维护一份 ID。
 */

import { useAppContext } from '../../State/AppContext';
import { AudioEngine } from '../../Audio/AudioEngine';
import { INSTRUMENT_PRESETS } from '../../Audio/InstrumentPreset';
import { INSTRUMENT_IDS, type InstrumentId } from '../../Audio/types';
import styles from './Controls.module.css';

export function InstrumentSelector() {
  const { state, setInstrument } = useAppContext();

  const handleSelect = (id: InstrumentId) => {
    if (id === state.instrument) return;
    // 点击也是用户手势，用来解锁/恢复 AudioContext
    AudioEngine.unlock();
    AudioEngine.setInstrument(id);
    setInstrument(id);
  };

  return (
    <div className={styles.controlGroup}>
      <label className={styles.label}>音色</label>
      <div className={styles.modeButtons}>
        {INSTRUMENT_IDS.map((id) => {
          const preset = INSTRUMENT_PRESETS[id];
          return (
            <button
              key={id}
              className={`${styles.modeBtn} ${state.instrument === id ? styles.modeBtnActive : ''}`}
              onClick={() => handleSelect(id)}
              title={preset.name}
              aria-pressed={state.instrument === id}
            >
              <span>{preset.shortName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
