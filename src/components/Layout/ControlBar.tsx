/**
 * ControlBar.tsx — 主控制栏
 *
 * 水平排列所有控制组件：Instrument, Tuning, Fret Count, Strum Speed, Velocity, Humanize
 *
 * 音量与延音不在这里：
 * - 音量由「力度」决定（力度同时决定音量与采样层）
 * - 延音由用户按住鼠标/按键的时长决定（松开即进入 release）
 */

import { useAppContext } from '../../State/AppContext';
import { TUNINGS } from '../../Music/Tuning';
import { FRET_COUNT_OPTIONS } from '../../Music/GuitarState';
import { InstrumentSelector } from '../Controls/InstrumentSelector';
import styles from './Layout.module.css';

export function ControlBar() {
  const { state, setTuning, setFretCount, setStrumSpeed, setVelocity, setHumanize } = useAppContext();

  return (
    <div className={styles.controlBar}>
      {/* Instrument */}
      <InstrumentSelector />

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

      {/* Velocity —— 同时决定音量与采样层 */}
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
          aria-label="演奏力度（同时决定音量）"
          title="力度越大，声音越响，同时会切换到音源中对应力度层的采样"
        />
      </div>

      {/* Humanize */}
      <div className={styles.controlGroup}>
        <label className={styles.controlLabel}>人性化</label>
        <span className={styles.tooltipWrap}>
          <button
            className={`${styles.humanizeBtn} ${state.humanize ? styles.humanizeBtnActive : ''}`}
            onClick={() => setHumanize(!state.humanize)}
            aria-pressed={state.humanize}
            aria-describedby="humanize-tip"
            aria-label={`人性化 ${state.humanize ? '开启' : '关闭'}`}
          >
            {state.humanize ? 'ON' : 'OFF'}
          </button>
          <span id="humanize-tip" role="tooltip" className={styles.tooltip}>
            开启后，每次拨弦的时间与力度都会有极轻微的随机变化，
            让连续演奏听起来更自然，不像机器在重复。
          </span>
        </span>
      </div>
    </div>
  );
}
