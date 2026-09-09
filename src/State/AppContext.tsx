/**
 * AppContext.tsx — 应用全局状态 Context
 *
 * Phase 07：URL State 支持。
 * - 从 URL 解析状态并恢复
 * - 状态变更同步到 URL
 * - 非法参数使用默认值
 * - localStorage 持久化
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { DEFAULT_STATE } from './AppState';
import type { AppState } from './AppState';
import type { NoteName } from '../Music/Note';
import { NOTE_NAMES } from '../Music/Note';
import { TUNINGS } from '../Music/Tuning';
import { CHORD_TYPES } from '../Music/Chord';
import { SCALE_TYPES } from '../Music/Scale';
import { isInstrumentId, LEGACY_INSTRUMENT_IDS, type InstrumentId } from '../Audio/types';

interface AppContextValue {
  state: AppState;
  setTuning: (id: string) => void;
  setCapo: (v: number) => void;
  setFretCount: (v: number) => void;
  setInstrument: (id: InstrumentId) => void;
  setStrumSpeed: (v: number) => void;
  setVelocity: (v: number) => void;
  setHumanize: (v: boolean) => void;
  setMode: (m: AppState['mode']) => void;
  setSelectedChordType: (id?: string) => void;
  setSelectedScaleType: (id?: string) => void;
  setRootNote: (n?: NoteName) => void;
  setIsRecording: (v: boolean) => void;
  setSelectedGroup: (n: number) => void;
  setShowNoteNames: (v: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_KEY = 'virtual-guitar-state';

// ─── URL State ───────────────────────────────────────

/** URL 参数名 → AppState 字段映射 */
const URL_PARAM_MAP: Record<string, keyof AppState> = {
  instrument: 'instrument',
  tuning: 'tuning',
  capo: 'capo',
  mode: 'mode',
  chord: 'selectedChordType',
  scale: 'selectedScaleType',
  root: 'rootNote',
  frets: 'fretCount',
};

/** 从 URL 解析状态（带校验） */
function parseUrlState(): Partial<AppState> {
  const params = new URLSearchParams(window.location.search);
  const result: Partial<AppState> = {};

  for (const [param, field] of Object.entries(URL_PARAM_MAP)) {
    const raw = params.get(param);
    if (raw === null) continue;

    switch (field) {
      case 'tuning':
        if (TUNINGS.some((t) => t.id === raw)) result.tuning = raw;
        break;
      case 'capo': {
        const n = parseInt(raw, 10);
        if (!isNaN(n) && n >= 0 && n <= 12) result.capo = n;
        break;
      }
      case 'fretCount': {
        const n = parseInt(raw, 10);
        if ([12, 15, 18, 21, 22].includes(n)) result.fretCount = n;
        break;
      }
      case 'mode':
        if (['play', 'chord', 'scale'].includes(raw)) result.mode = raw as AppState['mode'];
        break;
      case 'selectedChordType':
        if (CHORD_TYPES.some((c) => c.id === raw)) result.selectedChordType = raw;
        break;
      case 'selectedScaleType':
        if (SCALE_TYPES.some((s) => s.id === raw)) result.selectedScaleType = raw;
        break;
      case 'rootNote':
        if ((NOTE_NAMES as readonly string[]).includes(raw)) result.rootNote = raw as NoteName;
        break;
      case 'instrument':
        // 兼容 v0 的旧 ID（acoustic / nylon / clean-electric）
        if (isInstrumentId(raw)) result.instrument = raw;
        else if (raw in LEGACY_INSTRUMENT_IDS) result.instrument = LEGACY_INSTRUMENT_IDS[raw];
        break;
    }
  }

  return result;
}

/** 将状态同步到 URL（不刷新页面） */
function syncStateToUrl(state: AppState): void {
  const params = new URLSearchParams();

  if (state.tuning !== DEFAULT_STATE.tuning) params.set('tuning', state.tuning);
  if (state.capo !== DEFAULT_STATE.capo) params.set('capo', String(state.capo));
  if (state.fretCount !== DEFAULT_STATE.fretCount) params.set('frets', String(state.fretCount));
  if (state.mode !== DEFAULT_STATE.mode) params.set('mode', state.mode);
  if (state.selectedChordType) params.set('chord', state.selectedChordType);
  if (state.selectedScaleType) params.set('scale', state.selectedScaleType);
  if (state.rootNote && state.rootNote !== DEFAULT_STATE.rootNote) params.set('root', state.rootNote);
  if (state.instrument !== DEFAULT_STATE.instrument) params.set('instrument', state.instrument);

  const queryString = params.toString();
  const newUrl = queryString
    ? `${window.location.pathname}?${queryString}`
    : window.location.pathname;

  window.history.replaceState(null, '', newUrl);
}

// ─── localStorage ────────────────────────────────────

function loadPersistedState(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<AppState> & { instrument?: string };

    // 旧版本可能留下已失效的 instrument ID，直接回退到默认值
    if (parsed.instrument !== undefined) {
      if (isInstrumentId(parsed.instrument)) {
        // 合法，保持
      } else if (parsed.instrument in LEGACY_INSTRUMENT_IDS) {
        parsed.instrument = LEGACY_INSTRUMENT_IDS[parsed.instrument];
      } else {
        delete parsed.instrument;
      }
    }

    return parsed;
  } catch {
    // 忽略
  }
  return {};
}

function persistState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 忽略
  }
}

// ─── Provider ────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    // 优先级：URL > localStorage > 默认值
    const urlState = parseUrlState();
    const persisted = loadPersistedState();
    return {
      ...DEFAULT_STATE,
      ...persisted,
      ...urlState,
    };
  });

  // URL 同步（仅在浏览器环境）
  useEffect(() => {
    syncStateToUrl(state);
  }, [state]);

  const update = useCallback((patch: Partial<AppState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      persistState(next);
      return next;
    });
  }, []);

  const value: AppContextValue = {
    state,
    setTuning: (id) => update({ tuning: id }),
    setCapo: (v) => update({ capo: Math.max(0, Math.min(12, v)) }),
    setFretCount: (v) => update({ fretCount: v }),
    setInstrument: (id) => update({ instrument: id }),
    setStrumSpeed: (v) => update({ strumSpeed: v }),
    setVelocity: (v) => update({ velocity: v }),
    setHumanize: (v) => update({ humanize: v }),
    setMode: (m) => update({ mode: m }),
    setSelectedChordType: (id) => update({ selectedChordType: id }),
    setSelectedScaleType: (id) => update({ selectedScaleType: id }),
    setRootNote: (n) => update({ rootNote: n }),
    setIsRecording: (v) => update({ isRecording: v }),
    setSelectedGroup: (n) => update({ selectedGroup: n }),
    setShowNoteNames: (v) => update({ showNoteNames: v }),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
