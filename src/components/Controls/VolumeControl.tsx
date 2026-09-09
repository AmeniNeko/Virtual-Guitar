/**
 * VolumeControl.tsx — 音量和延音控制
 */

import { useAppContext } from '../../State/AppContext';
import { AudioEngine } from '../../Audio/AudioEngine';
import styles from './Controls.module.css';

export function VolumeControl() {
  const { state, setVolume, setSustain } = useAppContext();

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    AudioEngine.setVolume(v);
  };

  const handleSustainChange = (v: number) => {
    setSustain(v);
    AudioEngine.setSustainTime(0.1 + v * 4.9);
  };

  return (
    <>
      <div className={styles.controlGroup}>
        <label className={styles.label}>
          音量: {Math.round(state.volume * 100)}%
        </label>
        <input
          type="range"
          className={styles.slider}
          min={0}
          max={100}
          value={Math.round(state.volume * 100)}
          onChange={(e) => handleVolumeChange(Number(e.target.value) / 100)}
        />
      </div>
      <div className={styles.controlGroup}>
        <label className={styles.label}>
          延音: {Math.round(state.sustain * 100)}%
        </label>
        <input
          type="range"
          className={styles.slider}
          min={0}
          max={100}
          value={Math.round(state.sustain * 100)}
          onChange={(e) => handleSustainChange(Number(e.target.value) / 100)}
        />
      </div>
    </>
  );
}
