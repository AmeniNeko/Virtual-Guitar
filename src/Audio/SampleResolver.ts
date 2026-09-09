/**
 * SampleResolver.ts — (乐器, 音高, 力度) → SampleRegion
 *
 * 严格使用 SFZ 信息：
 * 1. 按 key range 筛选
 * 2. 按 velocity range (lovel/hivel) 筛选
 * 3. 多个同条件候选 → 确定性轮询（不是随机）
 *
 * 只有在 SFZ 完全没有覆盖该音高时才回退到"最近根音"，
 * 以保证指板上任何合法品位都不会静音。
 */

import { alternateGroupKey, pitchRatio, type SampleRegion } from './SampleRegion';
import type { SampleDatabase } from './SampleDatabase';
import type { InstrumentId } from './types';

export interface ResolvedSample {
  region: SampleRegion;
  /** 播放速率（含 transpose / tune） */
  ratio: number;
  /** 是否由"最近根音"回退选出（该音高不被任何 region 覆盖） */
  substituted: boolean;
}

export class SampleResolver {
  /** `${instrument}:${altGroupKey}` → 轮询计数 */
  private rotation = new Map<string, number>();
  private db: SampleDatabase;

  constructor(db: SampleDatabase) {
    this.db = db;
  }

  /** 纯筛选，不推进轮询 —— 供预加载使用。 */
  candidates(instrument: InstrumentId, midiNote: number, velocity: number): SampleRegion[] {
    const vel = clampVelocity(velocity);
    const covering = this.db.getByKey(instrument, midiNote);

    let matched = covering.filter((r) => vel >= r.velocityLow && vel <= r.velocityHigh);

    if (matched.length === 0 && covering.length > 0) {
      // 力度落在所有层之外：取距离最近的一层（保持映射正确，只是层不同）
      matched = [nearestVelocityLayer(covering, vel)];
    }

    if (matched.length === 0) return [];

    // 同一轮询组的候选才互为替代
    const groupKey = alternateGroupKey(matched[0]);
    return matched
      .filter((r) => alternateGroupKey(r) === groupKey)
      .sort((a, b) => a.alternateIndex - b.alternateIndex || a.id.localeCompare(b.id));
  }

  /**
   * 解析实际要播放的采样。多次调用会推进轮询。
   */
  resolve(
    instrument: InstrumentId,
    midiNote: number,
    velocity: number,
  ): ResolvedSample | null {
    const vel = clampVelocity(velocity);
    const candidates = this.candidates(instrument, midiNote, vel);

    if (candidates.length > 0) {
      const groupKey = `${instrument}:${alternateGroupKey(candidates[0])}`;
      const index = (this.rotation.get(groupKey) ?? 0) % candidates.length;
      this.rotation.set(groupKey, index + 1);
      const region = candidates[index];
      return { region, ratio: pitchRatio(region, midiNote), substituted: false };
    }

    // 覆盖率缺口（例如 FSS 最低音 39，但 Drop D 六弦是 38）
    const fallback = this.nearestRegion(instrument, midiNote, vel);
    if (!fallback) return null;
    return { region: fallback, ratio: pitchRatio(fallback, midiNote), substituted: true };
  }

  /**
   * 覆盖缺口回退：在整件乐器里找根音最接近、力度层最接近的 region。
   * 采样本身仍来自该乐器，不做任何音高"猜测"。
   */
  private nearestRegion(
    instrument: InstrumentId,
    midiNote: number,
    velocity: number,
  ): SampleRegion | null {
    const all = this.db.getRegions(instrument);
    if (all.length === 0) return null;

    let best: SampleRegion | null = null;
    let bestScore = Infinity;

    for (const region of all) {
      const keyDistance = Math.abs(region.rootKey - midiNote);
      const velocityDistance =
        velocity < region.velocityLow
          ? region.velocityLow - velocity
          : velocity > region.velocityHigh
            ? velocity - region.velocityHigh
            : 0;
      const score = keyDistance * 10 + velocityDistance;
      if (score < bestScore) {
        bestScore = score;
        best = region;
      }
    }

    return best;
  }

  /** 重置轮询状态（切换乐器时调用）。 */
  resetRotation(): void {
    this.rotation.clear();
  }
}

function nearestVelocityLayer(covering: SampleRegion[], velocity: number): SampleRegion {
  let best = covering[0];
  let bestDistance = Infinity;
  for (const region of covering) {
    const distance =
      velocity < region.velocityLow
        ? region.velocityLow - velocity
        : velocity > region.velocityHigh
          ? velocity - region.velocityHigh
          : 0;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = region;
    }
  }
  return best;
}

/** UI 滑杆可以到 0；0 力度会让音符完全静音，故下限取 1。 */
export function clampVelocity(velocity: number): number {
  if (!Number.isFinite(velocity)) return 100;
  const midi = velocity <= 1 ? velocity * 127 : velocity;
  return Math.max(1, Math.min(127, Math.round(midi)));
}
