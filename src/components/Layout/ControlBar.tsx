/**
 * ControlBar.tsx — 主控制栏
 *
 * 水平排列所有控制组件：Instrument, Tuning, Capo, Volume, Sustain, Strum Speed
 */

import { useAppContext } from '../../State/AppContext';
import { TUNINGS } from '../../Music/Tuning';
import { FRET_COUNT_OPTIONS } from '../../Music/GuitarState';
import { AudioEngine } from '../../Audio/AudioEngine';
import styles from './Layout.module.css';

export function ControlBar() {
  const { state, setTuning, setFretCount, setVolume, setSustain, setStrumSpeed, setVelocity, setHumanize } = useAppContext();

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    AudioEngine.setVolume(v);
  };

  const handleSustainChange = (v: number) => {
    setSustain(v);
    // state.sustain 是 0-1 比例，转换为 0.1-5 秒
    AudioEngine.setSustainTime(0.1 + v * 4.9);
  };

  return (
    <div className={styles.controlBar}>
      {/* Tuning */}
      <div className={styles.controlGroup}>
        <label className={styles.controlLabel} htmlFor="tuning-select">调弦</label>
        <select
          id="tuning-select"
          className={styles.controlSelect}
          value={state.tuning}
          onChange={(e) => setTuning(e.target.value)}
          aria-label="选择调弦方式"
        >
          {TUNINGS.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Fret Count */}
      <div className={styles.controlGroup}>
        <label className={styles.controlLabel}>品数</label>
        <div className={styles.fretCountButtons} role="group" aria-label="选择品数">
          {FRET_COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              className={`${styles.fretCountBtn} ${state.fretCount === n ? styles.fretCountBtnActive : ''}`}
              onClick={() => setFretCount(n)}
              aria-pressed={state.fretCount === n}
              aria-label={`${n}品`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Volume */}
      <div className={styles.controlGroup}>
        <label className={styles.controlLabel} htmlFor="volume-slider">音量: {Math.round(state.volume * 100)}%</label>
        <input
          id="volume-slider"
          type="range"
          className={styles.controlSlider}
          min={0}
          max={100}
          value={Math.round(state.volume * 100)}
          onChange={(e) => handleVolumeChange(Number(e.target.value) / 100)}
          aria-label="音量控制"
        />
      </div>

      {/* Sustain */}
      <div className={styles.controlGroup}>
        <label className={styles.controlLabel} htmlFor="sustain-slider">延音: {Math.round(state.sustain * 100)}%</label>
        <input
          id="sustain-slider"
          type="range"
          className={styles.controlSlider}
          min={0}
          max={100}
          value={Math.round(state.sustain * 100)}
          onChange={(e) => handleSustainChange(Number(e.target.value) / 100)}
          aria-label="延音控制"
        />
      </div>

      {/* Strum Speed */}
      <div className={styles.controlGroup}>
        <label className={styles.controlLabel} htmlFor="strum-slider">扫弦: {state.strumSpeed}ms</label>
        <input
          id="strum-slider"
          type="range"
          className={styles.controlSlider}
          min={0}
          max={200}
          value={state.strumSpeed}
          onChange={(e) => setStrumSpeed(Number(e.target.value))}
          aria-label="扫弦速度"
        />
      </div>

      {/* Velocity */}
      <div className={styles.controlGroup}>
        <label className={styles.controlLabel} htmlFor="velocity-slider">力度: {Math.round(state.velocity * 100)}%</label>
        <input
          id="velocity-slider"
          type="range"
          className={styles.controlSlider}
          min={0}
          max={100}
          value={Math.round(state.velocity * 100)}
          onChange={(e) => setVelocity(Number(e.target.value) / 100)}
          aria-label="力度控制"
        />
      </div>

      {/* Humanize */}
      <div className={styles.controlGroup}>
        <label className={styles.controlLabel}>人性化</label>
        <button
          className={`${styles.humanizeBtn} ${state.humanize ? styles.humanizeBtnActive : ''}`}
          onClick={() => setHumanize(!state.humanize)}
          aria-pressed={state.humanize}
          aria-label={`人性化 ${state.humanize ? '开启' : '关闭'}`}
        >
          {state.humanize ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
}
