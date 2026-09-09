/**
 * devtools.ts — 开发期调试入口
 *
 * 只在 `import.meta.env.DEV` 时安装，不参与生产构建。
 * 提供规范 §42 的 getAudioStats 与 §52/§53 的音频自检工具。
 *
 * 控制台用法：
 *   AudioEngine.getStats()
 *   AudioEngineTests.playNote(60)
 *   AudioEngineTests.playScale()
 *   await AudioEngineTests.selfCheck()
 */

import { AudioEngine } from './AudioEngine';
import { adaptSFZText, encodePath } from './InstrumentAdapter';
import { INSTRUMENT_PRESETS, presetSfzPath } from './InstrumentPreset';
import { parseSFZ } from './sfz/SFZParser';
import { INSTRUMENT_IDS, type InstrumentId } from './types';

export interface SelfCheckResult {
  instrument: InstrumentId;
  ok: boolean;
  regions: number;
  samples: number;
  keyRange: [number, number] | null;
  warnings: string[];
  errors: string[];
}

const MIDI_TEST_SEQUENCE = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72];

export const AudioEngineTests = {
  /** 逐半音播放 C4→C5，检查音高与采样是否正确。 */
  playNote(midiNote: number, velocity = 100): boolean {
    return AudioEngine.pluck({ midiNote, velocity });
  },

  playScale(startMidi = 60, count = MIDI_TEST_SEQUENCE.length): void {
    MIDI_TEST_SEQUENCE.slice(0, count).forEach((midi, i) => {
      void midi;
      AudioEngine.pluck({ midiNote: startMidi + i, velocity: 100 });
    });
  },

  /** 逐根弦的空弦音。 */
  playOpenStrings(tuning: [number, number, number, number, number, number]): void {
    tuning.forEach((midi, string) => {
      AudioEngine.pluck({ midiNote: midi, string, fret: 0, velocity: 100 });
    });
  },

  /** 同一音符快速重复 n 次（规范 §55 快速拨弦测试）。 */
  rapidRepeat(midiNote = 64, times = 16, intervalMs = 90): void {
    const start = AudioEngine.getStats().audioContextState === 'running' ? 0 : 0;
    for (let i = 0; i < times; i++) {
      AudioEngine.pluck({ midiNote, velocity: 100, when: start + (i * intervalMs) / 1000 });
    }
  },

  /**
   * 解析四套 SFZ，校验 region 数量、区间合法性与覆盖率。
   * 不加载任何 WAV，可在几秒内跑完。
   */
  async selfCheck(): Promise<SelfCheckResult[]> {
    const results: SelfCheckResult[] = [];

    for (const id of INSTRUMENT_IDS) {
      const preset = INSTRUMENT_PRESETS[id];
      const url = encodePath(presetSfzPath(preset));
      const errors: string[] = [];

      try {
        const response = await fetch(url);
        if (!response.ok) {
          results.push({
            instrument: id,
            ok: false,
            regions: 0,
            samples: 0,
            keyRange: null,
            warnings: [],
            errors: [`SFZ fetch failed: HTTP ${response.status}`],
          });
          continue;
        }

        const text = await response.text();
        const doc = parseSFZ(text);
        const { regions, warnings } = adaptSFZText(text, {
          instrument: id,
          sfzBaseDir: preset.sfzDir,
        });

        for (const region of regions) {
          if (region.keyLow > region.keyHigh) {
            errors.push(`${region.id}: lokey > hikey`);
          }
          if (region.velocityLow > region.velocityHigh) {
            errors.push(`${region.id}: lovel > hivel`);
          }
          if (region.rootKey < 0 || region.rootKey > 127) {
            errors.push(`${region.id}: rootKey out of range (${region.rootKey})`);
          }
        }

        const keys = regions.flatMap((r) => [r.keyLow, r.keyHigh]);
        const keyRange: [number, number] | null =
          keys.length > 0 ? [Math.min(...keys), Math.max(...keys)] : null;

        results.push({
          instrument: id,
          ok: errors.length === 0 && regions.length > 0,
          regions: regions.length,
          samples: new Set(regions.map((r) => r.sampleUrl)).size,
          keyRange,
          warnings: [...doc.warnings, ...warnings],
          errors,
        });
      } catch (error) {
        results.push({
          instrument: id,
          ok: false,
          regions: 0,
          samples: 0,
          keyRange: null,
          warnings: [],
          errors: [error instanceof Error ? error.message : String(error)],
        });
      }
    }

    console.table(
      results.map((r) => ({
        instrument: r.instrument,
        ok: r.ok,
        regions: r.regions,
        samples: r.samples,
        keys: r.keyRange ? `${r.keyRange[0]}–${r.keyRange[1]}` : '—',
        warnings: r.warnings.length,
        errors: r.errors.length,
      })),
    );

    return results;
  },

  /** 打印缓存与声部状态。 */
  stats() {
    return AudioEngine.getStats();
  },
};

/** 挂到 window，方便在浏览器控制台直接调用。非浏览器环境下静默跳过。 */
export function installDevTools(): void {
  if (typeof window === 'undefined') return;

  const target = window as unknown as Record<string, unknown>;
  target.AudioEngine = AudioEngine;
  target.AudioEngineTests = AudioEngineTests;
  console.info(
    '[AudioEngine] dev tools installed — try AudioEngine.getStats() or AudioEngineTests.selfCheck()',
  );
}
