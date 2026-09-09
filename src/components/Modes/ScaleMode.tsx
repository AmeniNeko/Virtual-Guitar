/**
 * ScaleMode.tsx — 音阶模式面板
 *
 * Phase 05：完整音阶系统。
 * - 根音选择
 * - 音阶类型选择
 * - 音程显示
 * - 构成音显示
 */

import { useAppContext } from '../../State/AppContext';
import {
  NOTE_NAMES,
  SCALE_TYPES,
  type ScaleType,
} from '../../Music/MusicTheory';
import { getScaleNoteNames, getScaleIntervalLabels } from '../../data/scales';
import styles from './Modes.module.css';

export function ScaleMode() {
  const { state, setRootNote, setSelectedScaleType } = useAppContext();

  const currentScaleType: ScaleType | undefined = state.selectedScaleType
    ? SCALE_TYPES.find((st) => st.id === state.selectedScaleType)
    : undefined;

  const scaleNotes = currentScaleType && state.rootNote
    ? getScaleNoteNames(state.rootNote, currentScaleType)
    : [];

  const intervalLabels = currentScaleType
    ? getScaleIntervalLabels(currentScaleType)
    : [];

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>根音</h4>
        <div className={styles.noteGrid}>
          {NOTE_NAMES.map((note) => (
            <button
              key={note}
              className={`${styles.noteBtn} ${state.rootNote === note ? styles.noteBtnActive : ''}`}
              onClick={() => setRootNote(note)}
            >
              {note}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>音阶类型</h4>
        <div className={styles.scaleGrid}>
          {SCALE_TYPES.map((type: ScaleType) => (
            <button
              key={type.id}
              className={`${styles.scaleBtn} ${state.selectedScaleType === type.id ? styles.scaleBtnActive : ''}`}
              onClick={() => setSelectedScaleType(type.id)}
            >
              {type.name}
            </button>
          ))}
        </div>
      </div>

      {currentScaleType && state.rootNote && (
        <div className={styles.scaleDetail}>
          <div className={styles.scaleName}>
            {state.rootNote} {currentScaleType.name}
          </div>

          {/* 音程 */}
          <div className={styles.scaleIntervals}>
            {intervalLabels.map((label, i) => (
              <span key={i} className={styles.intervalTag}>
                {label}
              </span>
            ))}
          </div>

          {/* 构成音 */}
          <div className={styles.scaleNotes}>
            <span className={styles.scaleNotesLabel}>构成音：</span>
            {scaleNotes.map((note, i) => (
              <span key={i} className={styles.scaleNoteTag}>{note}</span>
            ))}
          </div>

          {/* 音阶公式 */}
          <div className={styles.scaleFormula}>
            <span className={styles.scaleFormulaLabel}>公式：</span>
            {currentScaleType.intervals.map((interval, i) => (
              <span key={i} className={styles.scaleFormulaStep}>
                {interval}st
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
