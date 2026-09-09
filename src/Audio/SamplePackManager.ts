/**
 * SamplePackManager.ts — 音源包安装检测
 *
 * 只返回状态，不做任何 UI 提示，也不自动下载第三方音源。
 * 用户自行把 Sample Pack 放入 public/sounds/ 后，这里负责识别。
 */

import { encodePath } from './InstrumentAdapter';
import { INSTRUMENT_PRESETS, presetSfzPath } from './InstrumentPreset';
import { logger } from './Logger';
import { INSTRUMENT_IDS, type InstrumentId } from './types';

export type PackStatus = 'installed' | 'missing' | 'unknown';

export class SamplePackManager {
  /** 逐个检查四套音源是否就位。 */
  async checkAll(): Promise<Record<InstrumentId, PackStatus>> {
    const entries = await Promise.all(
      INSTRUMENT_IDS.map(async (id) => [id, await this.check(id)] as const),
    );
    return Object.fromEntries(entries) as Record<InstrumentId, PackStatus>;
  }

  async check(id: InstrumentId): Promise<PackStatus> {
    const url = encodePath(presetSfzPath(INSTRUMENT_PRESETS[id]));
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) return 'installed';
      if (response.status === 404 || response.status === 403) return 'missing';
      return 'unknown';
    } catch (error) {
      logger.warn(`pack check failed for ${id}:`, error);
      return 'unknown';
    }
  }

  /** 缺失的音源包（供 UI 自行决定如何提示）。 */
  async missing(): Promise<InstrumentId[]> {
    const all = await this.checkAll();
    return INSTRUMENT_IDS.filter((id) => all[id] !== 'installed');
  }
}
