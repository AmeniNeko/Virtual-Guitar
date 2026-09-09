/**
 * ChordMode.tsx — 和弦模式面板
 *
 * - 根音选择
 * - 和弦类型选择
 * - 指法图
 * - 音程显示
 * - 播放模式（上扫/下扫/同时/分解）
 * - 和弦音分组显示
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '../../State/AppContext';
import { NOTE_NAMES, CHORD_TYPES, type ChordType } from '../../Music/MusicTheory';
import { findChordFingering, getChordNoteNames, type ChordFingering } from '../../data/chords';
import { getTuningById, getFretMidi } from '../../Music/Tuning';
import { AudioEngine } from '../../Audio/AudioEngine';
import styles from './Modes.module.css';

const DIAGRAM = {
  width: 140,
  height: 100,
  leftPad: 28,
  topPad: 18,
  fretWidth: 18,
  stringGap: 14,
  frets: 5,
};

/** 和弦音分组：按弦分组，每组对应一个手位 */
interface NoteGroup {
  id: number;
  label: string;
  /** 该组包含的弦索引 */
  strings: number[];
  /** 该组的 MIDI 音符 */
  midis: number[];
}

/** 将和弦音分成手位组 */
function buildNoteGroups(chord: ChordFingering, tuningId: string, capo: number): NoteGroup[] {
  const tuning = getTuningById(tuningId);
  const groups: NoteGroup[] = [];
  const activeStrings: number[] = [];

  for (let s = 0; s < 6; s++) {
    if (chord.frets[s] !== null && chord.frets[s]! >= 0) {
      activeStrings.push(s);
    }
  }

  if (activeStrings.length === 0) return groups;

  // 分组策略：按品数范围分组
  // 低把位 (0-3品), 中把位 (4-7品), 高把位 (8+品)
  const lowStrings = activeStrings.filter((s) => (chord.frets[s] ?? 0) <= 3);
  const midStrings = activeStrings.filter((s) => {
    const f = chord.frets[s] ?? 0;
    return f >= 4 && f <= 7;
  });
  const highStrings = activeStrings.filter((s) => (chord.frets[s] ?? 0) >= 8);

  if (lowStrings.length > 0) {
    groups.push({
      id: 0,
      label: '低把位',
      strings: lowStrings,
      midis: lowStrings.map((s) => getFretMidi(tuning.strings[s], chord.frets[s]!, capo)),
    });
  }
  if (midStrings.length > 0) {
    groups.push({
      id: groups.length,
      label: '中把位',
      strings: midStrings,
      midis: midStrings.map((s) => getFretMidi(tuning.strings[s], chord.frets[s]!, capo)),
    });
  }
  if (highStrings.length > 0) {
    groups.push({
      id: groups.length,
      label: '高把位',
      strings: highStrings,
      midis: highStrings.map((s) => getFretMidi(tuning.strings[s], chord.frets[s]!, capo)),
    });
  }

  // 如果只有一个把位，不分组
  if (groups.length === 1) {
    groups[0].label = '全部';
  }

  return groups;
}

export function ChordMode() {
  const { state, setRootNote, setSelectedChordType, setSelectedGroup } = useAppContext();
  const diagramCanvasRef = useRef<HTMLCanvasElement>(null);
  const selectedGroup = state.selectedGroup;

  const currentChord: ChordFingering | undefined =
    state.rootNote && state.selectedChordType
      ? findChordFingering(state.rootNote, state.selectedChordType)
      : undefined;

  const chordNotes = currentChord
    ? getChordNoteNames(currentChord.root, currentChord.type)
    : [];

  // 构建分组
  const noteGroups = useMemo(
    () => currentChord ? buildNoteGroups(currentChord, state.tuning, state.capo) : [],
    [currentChord, state.tuning, state.capo]
  );

  // 重置选中组
  useEffect(() => {
    setSelectedGroup(0);
  }, [currentChord?.name]);

  // 绘制指法图
  const drawDiagram = useCallback(() => {
    const canvas = diagramCanvasRef.current;
    if (!canvas || !currentChord) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const d = DIAGRAM;
    const W = d.width;
    const H = d.height;

    if (canvas.width !== W * devicePixelRatio || canvas.height !== H * devicePixelRatio) {
      canvas.width = W * devicePixelRatio;
      canvas.height = H * devicePixelRatio;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.scale(devicePixelRatio, devicePixelRatio);
    } else {
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    const frets = currentChord.frets;

    // 横按线
    if (currentChord.barre > 0) {
      const x = d.leftPad + (currentChord.barre - 0.5) * d.fretWidth;
      let minS = 5, maxS = 0;
      for (let s = 0; s < 6; s++) {
        if (frets[s] === currentChord.barre) {
          minS = Math.min(minS, s);
          maxS = Math.max(maxS, s);
        }
      }
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, d.topPad + minS * d.stringGap);
      ctx.lineTo(x, d.topPad + maxS * d.stringGap);
      ctx.stroke();
    }

    // 品丝
    for (let f = 0; f <= d.frets; f++) {
      const x = d.leftPad + f * d.fretWidth;
      ctx.strokeStyle = f === 0 ? '#444' : '#222';
      ctx.lineWidth = f === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, d.topPad);
      ctx.lineTo(x, d.topPad + 5 * d.stringGap);
      ctx.stroke();
    }

    // 弦
    for (let s = 0; s < 6; s++) {
      const y = d.topPad + s * d.stringGap;
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(d.leftPad, y);
      ctx.lineTo(d.leftPad + d.frets * d.fretWidth, y);
      ctx.stroke();
    }

    // 按弦点
    for (let s = 0; s < 6; s++) {
      const fret = frets[s];
      const y = d.topPad + s * d.stringGap;

      if (fret === null || fret === -1) {
        ctx.fillStyle = '#555';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('X', d.leftPad - d.fretWidth * 0.5, y + 4);
      } else if (fret === 0) {
        ctx.strokeStyle = '#7EBCF5';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(d.leftPad - d.fretWidth * 0.5, y, 4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (!(currentChord.barre > 0 && fret === currentChord.barre)) {
        const x = d.leftPad + (fret - 0.5) * d.fretWidth;
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();

        const finger = currentChord.fingers[s];
        if (finger && finger > 0) {
          ctx.fillStyle = '#ccc';
          ctx.font = 'bold 7px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(finger), x, y);
          ctx.textBaseline = 'alphabetic';
        }
      }
    }

    // 品号
    ctx.fillStyle = '#444';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    for (let f = 1; f <= d.frets; f++) {
      ctx.fillText(String(f), d.leftPad + (f - 0.5) * d.fretWidth, d.topPad + 5 * d.stringGap + 10);
    }
  }, [currentChord]);

  useEffect(() => { drawDiagram(); }, [drawDiagram]);

  // 播放和弦
  const playChordSound = useCallback(
    (mode: 'up' | 'down' | 'simultaneous' | 'arpeggio') => {
      if (!currentChord) return;
      const tuning = getTuningById(state.tuning);
      const midiNotes: number[] = [];
      currentChord.frets.forEach((fret, s) => {
        if (fret !== null && fret >= 0) {
          midiNotes.push(getFretMidi(tuning.strings[s], fret, state.capo));
        }
      });

      if (mode === 'simultaneous') {
        midiNotes.forEach((midi) => {
          AudioEngine.playNote({ midi, velocity: state.velocity });
        });
      } else if (mode === 'arpeggio') {
        midiNotes.forEach((midi, i) => {
          setTimeout(() => {
            AudioEngine.playNote({ midi, velocity: state.velocity });
          }, i * 100);
        });
      } else if (mode === 'up') {
        // 上扫：6弦→1弦（低音→高音）
        AudioEngine.playChord(midiNotes, {
          velocity: state.velocity,
          strumDelay: state.strumSpeed,
        });
      } else {
        // 下扫：1弦→6弦（高音→低音）
        const reversed = [...midiNotes].reverse();
        reversed.forEach((midi, i) => {
          setTimeout(() => {
            AudioEngine.playNote({ midi, velocity: state.velocity });
          }, i * state.strumSpeed);
        });
      }
    },
    [currentChord, state.tuning, state.capo, state.velocity, state.strumSpeed]
  );

  // 点击分组中的音符
  const handleGroupClick = useCallback((groupIdx: number) => {
    setSelectedGroup(groupIdx);
  }, []);

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
        <h4 className={styles.sectionTitle}>和弦类型</h4>
        <div className={styles.chordGrid}>
          {CHORD_TYPES.map((type: ChordType) => (
            <button
              key={type.id}
              className={`${styles.chordBtn} ${state.selectedChordType === type.id ? styles.chordBtnActive : ''}`}
              onClick={() => {
                setSelectedChordType(type.id);
                if (state.rootNote) {
                  const chord = findChordFingering(state.rootNote, type.id);
                  if (chord) {
                    const tuning = getTuningById(state.tuning);
                    const midiNotes: number[] = [];
                    chord.frets.forEach((fret, s) => {
                      if (fret !== null && fret >= 0) {
                        midiNotes.push(getFretMidi(tuning.strings[s], fret, state.capo));
                      }
                    });
                    AudioEngine.playChord(midiNotes, {
                      velocity: state.velocity,
                      strumDelay: state.strumSpeed,
                    });
                  }
                }
              }}
            >
              {type.name || 'Major'}
            </button>
          ))}
        </div>
      </div>

      {currentChord && (
        <div className={styles.chordDetail}>
          <div className={styles.chordDetailHeader}>
            <span className={styles.chordName}>{currentChord.name}</span>
          </div>

          {/* 指法图 */}
          <div className={styles.chordDiagram}>
            <canvas ref={diagramCanvasRef} />
          </div>

          {/* 播放按钮 2x2 */}
          <div className={styles.playbackGrid}>
            <button className={styles.playBtn} onClick={() => playChordSound('up')}>
              上扫
            </button>
            <button className={styles.playBtn} onClick={() => playChordSound('down')}>
              下扫
            </button>
            <button className={styles.playBtn} onClick={() => playChordSound('simultaneous')}>
              同时
            </button>
            <button className={styles.playBtn} onClick={() => playChordSound('arpeggio')}>
              分解
            </button>
          </div>

          {/* 分组选择 */}
          {noteGroups.length > 1 && (
            <div className={styles.groupSection}>
              <span className={styles.groupLabel}>手位：</span>
              <div className={styles.groupButtons}>
                {noteGroups.map((group, i) => (
                  <button
                    key={group.id}
                    className={`${styles.groupBtn} ${selectedGroup === i ? styles.groupBtnActive : ''}`}
                    onClick={() => handleGroupClick(i)}
                  >
                    {group.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 音程 */}
          <div className={styles.chordIntervals}>
            {currentChord.intervals.map((interval, i) => (
              <span key={i} className={styles.intervalTag}>{interval}</span>
            ))}
          </div>

          {/* 构成音 */}
          <div className={styles.chordNotes}>
            <span className={styles.chordNotesLabel}>构成音：</span>
            {chordNotes.map((note, i) => (
              <span key={i} className={styles.chordNoteTag}>{note}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
