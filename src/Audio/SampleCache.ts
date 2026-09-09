/**
 * SampleCache.ts — 解码后的 AudioBuffer 缓存
 *
 * - 键是解析后的绝对 URL（clean 与 dist1 的采样文件名完全相同，必须区分）
 * - LRU：Map 的插入顺序即最近使用顺序
 * - 按解码后的 Float32 字节数计费（WAV → Float32 约 ×4/3）
 * - 引用计数：正在发声的 voice 持有的 buffer 永不被驱逐
 * - in-flight 去重：同一 URL 并发请求只解码一次
 */

import { logger } from './Logger';
import { decodeWavToAudioBuffer } from './WavMetadata';
import type { SampleDatabase } from './SampleDatabase';

export interface SampleCacheStats {
  count: number;
  bytes: number;
  budgetBytes: number;
  hits: number;
  misses: number;
  hitRate: number;
}

interface CacheEntry {
  buffer: AudioBuffer;
  bytes: number;
  refs: number;
}

export const DEFAULT_CACHE_BUDGET_BYTES = 256 * 1024 * 1024;

/** 低于这个值缓存就没有意义了（单个电吉他采样解码后约 12MB） */
export const MIN_CACHE_BUDGET_BYTES = 1024 * 1024;

export class SampleCache {
  private entries = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<AudioBuffer>>();
  private bytes = 0;
  private hits = 0;
  private misses = 0;
  private budgetBytes: number;
  private ctx: BaseAudioContext;
  private database?: SampleDatabase;

  constructor(
    ctx: BaseAudioContext,
    budgetBytes: number = DEFAULT_CACHE_BUDGET_BYTES,
    database?: SampleDatabase,
  ) {
    this.ctx = ctx;
    this.database = database;
    this.budgetBytes = Math.max(MIN_CACHE_BUDGET_BYTES, budgetBytes);
  }

  setBudget(bytes: number): void {
    this.budgetBytes = Math.max(MIN_CACHE_BUDGET_BYTES, bytes);
    this.evictIfNeeded();
  }

  getBudget(): number {
    return this.budgetBytes;
  }

  has(url: string): boolean {
    return this.entries.has(url);
  }

  /** 同步读取（会提升 LRU 位置并计入命中）。 */
  get(url: string): AudioBuffer | undefined {
    const entry = this.entries.get(url);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    this.hits++;
    this.entries.delete(url);
    this.entries.set(url, entry);
    return entry.buffer;
  }

  /** 标记正在使用；被持有的 buffer 不会被驱逐。 */
  retain(url: string): void {
    const entry = this.entries.get(url);
    if (entry) entry.refs++;
  }

  release(url: string): void {
    const entry = this.entries.get(url);
    if (entry && entry.refs > 0) entry.refs--;
  }

  /** 加载并解码；同一 URL 并发调用共享同一个 Promise。 */
  load(url: string): Promise<AudioBuffer> {
    const cached = this.entries.get(url);
    if (cached) {
      this.hits++;
      this.entries.delete(url);
      this.entries.set(url, cached);
      return Promise.resolve(cached.buffer);
    }

    const pending = this.inFlight.get(url);
    if (pending) return pending;

    this.misses++;
    const promise = this.decode(url).finally(() => {
      this.inFlight.delete(url);
    });
    this.inFlight.set(url, promise);
    return promise;
  }

  /** 预加载（不关心结果，不阻塞调用方）。 */
  preload(url: string): void {
    if (this.entries.has(url) || this.inFlight.has(url)) return;
    void this.load(url).catch(() => {
      /* 错误已在 decode() 内记录 */
    });
  }

  private async decode(url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        logger.fail('Failed to fetch sample', {
          path: url,
          sample: url.split('/').pop(),
        }) + `\n  Reason: HTTP ${response.status} ${response.statusText}`,
      );
    }

    const raw = await response.arrayBuffer();
    let audioBuffer: AudioBuffer | null = null;

    try {
      // decodeAudioData 会 detach 传入的 ArrayBuffer，故先切一份副本留给回退路径
      audioBuffer = await this.ctx.decodeAudioData(raw.slice(0));
    } catch {
      audioBuffer = decodeWavToAudioBuffer(this.ctx, raw);
      if (audioBuffer) {
        logger.log('Native decode failed, used manual WAV fallback:', url);
      }
    }

    if (!audioBuffer) {
      throw new Error(
        logger.fail('Audio decode failed', {
          path: url,
          sample: url.split('/').pop(),
        }),
      );
    }

    const bytes = audioBuffer.length * audioBuffer.numberOfChannels * 4;
    this.entries.set(url, { buffer: audioBuffer, bytes, refs: 0 });
    this.bytes += bytes;

    this.database?.setBufferMetadata(url, {
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      frames: audioBuffer.length,
      duration: audioBuffer.duration,
      bytes,
    });

    logger.log(
      `sample loaded ${url} (${audioBuffer.numberOfChannels}ch ${audioBuffer.sampleRate}Hz ` +
        `${audioBuffer.duration.toFixed(2)}s ${(bytes / 1048576).toFixed(1)}MB)`,
    );

    this.evictIfNeeded();
    return audioBuffer;
  }

  /** 从最久未使用的一端驱逐，跳过被 voice 持有的条目。 */
  private evictIfNeeded(): void {
    if (this.bytes <= this.budgetBytes) return;

    for (const [url, entry] of this.entries) {
      if (this.bytes <= this.budgetBytes) break;
      if (entry.refs > 0) continue;
      this.entries.delete(url);
      this.bytes -= entry.bytes;
      logger.log(`cache evict ${url}`);
    }

    if (this.bytes > this.budgetBytes) {
      logger.warn(
        `sample cache over budget: ${(this.bytes / 1048576).toFixed(1)}MB / ` +
          `${(this.budgetBytes / 1048576).toFixed(1)}MB — all remaining buffers are in use`,
      );
    }
  }

  stats(): SampleCacheStats {
    const total = this.hits + this.misses;
    return {
      count: this.entries.size,
      bytes: this.bytes,
      budgetBytes: this.budgetBytes,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /** 已解码的采样数（供 getStats） */
  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
    this.inFlight.clear();
    this.bytes = 0;
  }
}
