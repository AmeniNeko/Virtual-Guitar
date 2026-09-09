/**
 * SampleDatabase.ts — 乐器 → SampleRegion 索引
 *
 * 启动时只建立 region 索引与元数据，不加载任何 WAV。
 * WAV 元数据在采样被解码后回填（见 setBufferMetadata）。
 */

import type { SampleRegion } from './SampleRegion';
import type { InstrumentId } from './types';

export interface SampleBufferMetadata {
  sampleRate: number;
  channels: number;
  /** 采样帧数 */
  frames: number;
  duration: number;
  /** 解码后占用的字节数（Float32） */
  bytes: number;
}

interface InstrumentEntry {
  regions: SampleRegion[];
  /** midi → 覆盖该音高的 region（惰性建立） */
  byKey: Map<number, SampleRegion[]> | null;
}

export class SampleDatabase {
  private entries = new Map<InstrumentId, InstrumentEntry>();
  /** sampleUrl → 解码后已知的元数据 */
  private bufferMetadata = new Map<string, SampleBufferMetadata>();

  setRegions(instrument: InstrumentId, regions: SampleRegion[]): void {
    this.entries.set(instrument, { regions, byKey: null });
  }

  has(instrument: InstrumentId): boolean {
    return this.entries.has(instrument);
  }

  getRegions(instrument: InstrumentId): SampleRegion[] {
    return this.entries.get(instrument)?.regions ?? [];
  }

  regionCount(instrument: InstrumentId): number {
    return this.getRegions(instrument).length;
  }

  /** 覆盖指定音高的所有 region（未按力度过滤）。 */
  getByKey(instrument: InstrumentId, midiNote: number): SampleRegion[] {
    const entry = this.entries.get(instrument);
    if (!entry) return [];
    if (!entry.byKey) entry.byKey = buildKeyIndex(entry.regions);
    return entry.byKey.get(midiNote) ?? [];
  }

  /** 该乐器所有被覆盖的音高，升序。用于覆盖率自检。 */
  coveredKeys(instrument: InstrumentId): number[] {
    const entry = this.entries.get(instrument);
    if (!entry) return [];
    const keys = new Set<number>();
    for (const r of entry.regions) {
      for (let k = r.keyLow; k <= r.keyHigh; k++) keys.add(k);
    }
    return [...keys].sort((a, b) => a - b);
  }

  /** 该乐器所有采样 URL（去重）。 */
  sampleUrls(instrument: InstrumentId): string[] {
    const urls = new Set<string>();
    for (const r of this.getRegions(instrument)) urls.add(r.sampleUrl);
    return [...urls];
  }

  setBufferMetadata(url: string, meta: SampleBufferMetadata): void {
    this.bufferMetadata.set(url, meta);
  }

  getBufferMetadata(url: string): SampleBufferMetadata | undefined {
    return this.bufferMetadata.get(url);
  }

  clear(instrument?: InstrumentId): void {
    if (instrument) this.entries.delete(instrument);
    else {
      this.entries.clear();
      this.bufferMetadata.clear();
    }
  }
}

function buildKeyIndex(regions: SampleRegion[]): Map<number, SampleRegion[]> {
  const index = new Map<number, SampleRegion[]>();
  for (const region of regions) {
    for (let key = region.keyLow; key <= region.keyHigh; key++) {
      let bucket = index.get(key);
      if (!bucket) {
        bucket = [];
        index.set(key, bucket);
      }
      bucket.push(region);
    }
  }
  return index;
}
