/**
 * InstrumentManager.ts — 乐器加载与预加载
 *
 * 启动流程（严禁一次性加载全部 WAV）：
 *   fetch .sfz → parse → adapt → SampleDatabase（只有元数据）
 *   然后按优先级、受预算约束地后台预加载常用音域。
 *
 * epoch 守卫：切乐器时若旧加载晚到，直接丢弃，不污染新乐器。
 */

import { adaptSFZText, encodePath } from './InstrumentAdapter';
import { getPreset, presetSfzPath } from './InstrumentPreset';
import { logger } from './Logger';
import type { SampleCache } from './SampleCache';
import type { SampleDatabase } from './SampleDatabase';
import type { SampleResolver } from './SampleResolver';
import type { AudioEngineState, InstrumentId } from './types';

export interface InstrumentLoadState {
  state: AudioEngineState;
  error: string | null;
  regions: number;
  warnings: string[];
}

/** 预加载并发上限：够快，又不会把主线程/网络打满。 */
const MAX_PRELOAD_INFLIGHT = 3;

export class InstrumentManager {
  private states = new Map<InstrumentId, InstrumentLoadState>();
  private current: InstrumentId = 'nylon_classical';
  private epoch = 0;
  private queue: string[] = [];
  private inflight = 0;

  onStateChange?: (id: InstrumentId, state: AudioEngineState, error: string | null) => void;

  private db: SampleDatabase;
  private cache: SampleCache;
  private resolver: SampleResolver;

  constructor(db: SampleDatabase, cache: SampleCache, resolver: SampleResolver) {
    this.db = db;
    this.cache = cache;
    this.resolver = resolver;
  }

  getCurrent(): InstrumentId {
    return this.current;
  }

  getState(id: InstrumentId): InstrumentLoadState {
    return this.states.get(id) ?? { state: 'idle', error: null, regions: 0, warnings: [] };
  }

  isReady(id: InstrumentId): boolean {
    return this.getState(id).state === 'ready';
  }

  /**
   * 加载乐器。重复调用同一乐器且已 ready 时直接返回。
   */
  async load(id: InstrumentId): Promise<void> {
    const existing = this.states.get(id);
    if (existing?.state === 'ready') {
      this.current = id;
      return;
    }
    if (existing?.state === 'loading') {
      this.current = id;
      return;
    }

    const myEpoch = ++this.epoch;
    this.current = id;
    this.setState(id, 'loading', null);

    const preset = getPreset(id);
    const url = encodePath(presetSfzPath(preset));

    try {
      const response = await fetch(url);
      if (myEpoch !== this.epoch) return;

      if (!response.ok) {
        throw new Error(
          logger.fail('Failed to load SFZ', {
            instrument: id,
            path: url,
          }) + `\n  Reason: HTTP ${response.status} ${response.statusText}`,
        );
      }

      const text = await response.text();
      if (myEpoch !== this.epoch) return;

      const { regions, warnings } = adaptSFZText(text, {
        instrument: id,
        sfzBaseDir: preset.sfzDir,
      });

      if (regions.length === 0) {
        throw new Error(
          logger.fail('SFZ contains no usable region', {
            instrument: id,
            path: url,
          }),
        );
      }

      this.db.setRegions(id, regions);
      for (const warning of warnings) logger.warn(`[${id}] ${warning}`);

      this.states.set(id, {
        state: 'ready',
        error: null,
        regions: regions.length,
        warnings,
      });
      this.onStateChange?.(id, 'ready', null);
      logger.log(`SFZ parsed: ${id} — ${regions.length} regions, ${warnings.length} warnings`);

      this.preloadCore(id);
    } catch (error) {
      if (myEpoch !== this.epoch) return;
      const message = error instanceof Error ? error.message : String(error);
      this.states.set(id, {
        state: 'error',
        error: message,
        regions: 0,
        warnings: [],
      });
      this.onStateChange?.(id, 'error', message);
      logger.error(message);
    }
  }

  /** 记录用户弹过的音，顺带预加载邻近音高。 */
  notePlayed(midiNote: number): void {
    const id = this.current;
    if (!this.isReady(id)) return;

    const urls: string[] = [];
    for (let midi = midiNote - 2; midi <= midiNote + 2; midi++) {
      if (midi < 21 || midi > 108) continue;
      for (const velocity of [40, 110]) {
        const candidates = this.resolver.candidates(id, midi, velocity);
        if (candidates.length > 0) urls.push(candidates[0].sampleUrl);
      }
    }
    this.enqueue(urls);
  }

  /** 预加载当前乐器的核心音域（两个力度层，每个音高只取轮询第一个）。 */
  private preloadCore(id: InstrumentId): void {
    const preset = getPreset(id);
    const [low, high] = preset.coreRange;
    const urls: string[] = [];
    for (let midi = low; midi <= high; midi++) {
      for (const velocity of [40, 110]) {
        const candidates = this.resolver.candidates(id, midi, velocity);
        if (candidates.length > 0) urls.push(candidates[0].sampleUrl);
      }
    }
    logger.log(`preload ${id}: ${urls.length} samples queued (budget-aware)`);
    this.enqueue(urls);
  }

  private enqueue(urls: string[]): void {
    for (const url of urls) {
      if (this.queue.includes(url) || this.cache.has(url)) continue;
      this.queue.push(url);
    }
    this.pump();
  }

  private pump(): void {
    while (this.inflight < MAX_PRELOAD_INFLIGHT && this.queue.length > 0) {
      // 预算保护：剩余空间不足时停止预加载，把内存留给真正要弹的音
      const stats = this.cache.stats();
      if (stats.bytes > stats.budgetBytes * 0.85) {
        logger.log(`preload paused: cache at ${(stats.bytes / 1048576).toFixed(0)}MB`);
        this.queue.length = 0;
        return;
      }

      const url = this.queue.shift();
      if (!url || this.cache.has(url)) continue;

      this.inflight++;
      void this.cache
        .load(url)
        .catch(() => {
          /* 错误已记录 */
        })
        .finally(() => {
          this.inflight--;
          this.pump();
        });
    }
  }

  /** 切换乐器时清空待预加载队列。 */
  cancelPreload(): void {
    this.queue.length = 0;
  }

  private setState(id: InstrumentId, state: AudioEngineState, error: string | null): void {
    const prev = this.states.get(id);
    this.states.set(id, {
      state,
      error,
      regions: prev?.regions ?? 0,
      warnings: prev?.warnings ?? [],
    });
  }
}
