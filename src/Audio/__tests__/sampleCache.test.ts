/**
 * sampleCache.test.ts — LRU、预算、in-flight 去重、引用计数
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { MIN_CACHE_BUDGET_BYTES, SampleCache } from '../SampleCache';
import { FakeAudioContext, asAudioContext } from './mocks/fakeAudioContext';

/** 每个字节解码成 8 字节（2 声道 × Float32），便于精确断言预算行为 */
const DECODE_EXPANSION = 8;

function stubFetch(bytes: number): { calls: number } {
  const counter = { calls: 0 };
  globalThis.fetch = (async () => {
    counter.calls++;
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => new ArrayBuffer(bytes),
    };
  }) as unknown as typeof fetch;
  return counter;
}

function makeCache(budget = MIN_CACHE_BUDGET_BYTES): SampleCache {
  return new SampleCache(asAudioContext(new FakeAudioContext()), budget);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SampleCache', () => {
  it('同一 URL 第二次访问命中缓存，不再请求', async () => {
    const fetchCounter = stubFetch(1000);
    const cache = makeCache();

    await cache.load('/a.wav');
    await cache.load('/a.wav');

    expect(fetchCounter.calls).toBe(1);
    expect(cache.stats().hits).toBe(1);
    expect(cache.stats().misses).toBe(1);
  });

  it('并发请求同一 URL 只解码一次（in-flight 去重）', async () => {
    const fetchCounter = stubFetch(1000);
    const cache = makeCache();

    const [a, b] = await Promise.all([cache.load('/a.wav'), cache.load('/a.wav')]);

    expect(fetchCounter.calls).toBe(1);
    expect(a).toBe(b);
  });

  it('超出预算时从最久未使用的一端驱逐', async () => {
    const perSample = MIN_CACHE_BUDGET_BYTES * 0.8 / DECODE_EXPANSION;
    stubFetch(perSample);
    const cache = makeCache();

    await cache.load('/a.wav');
    await cache.load('/b.wav');

    // 两个加起来 1.6 倍预算 → 最旧的被驱逐
    expect(cache.has('/a.wav')).toBe(false);
    expect(cache.has('/b.wav')).toBe(true);
    expect(cache.stats().bytes).toBeLessThanOrEqual(MIN_CACHE_BUDGET_BYTES);
  });

  it('被 voice 持有的采样不会被驱逐', async () => {
    const perSample = MIN_CACHE_BUDGET_BYTES * 0.8 / DECODE_EXPANSION;
    stubFetch(perSample);
    const cache = makeCache();

    await cache.load('/a.wav');
    cache.retain('/a.wav');
    await cache.load('/b.wav');

    expect(cache.has('/a.wav')).toBe(true);

    cache.release('/a.wav');
    await cache.load('/c.wav');
    expect(cache.has('/a.wav')).toBe(false);
  });

  it('命中率统计正确', async () => {
    stubFetch(1000);
    const cache = makeCache();

    await cache.load('/a.wav');
    cache.get('/a.wav');
    cache.get('/a.wav');
    cache.get('/missing.wav');

    const stats = cache.stats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(2);
    expect(stats.hitRate).toBeCloseTo(0.5, 6);
  });

  it('加载失败时 reject，而不是静默返回空 buffer', async () => {
    globalThis.fetch = (async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })) as unknown as typeof fetch;

    const cache = makeCache();
    await expect(cache.load('/missing.wav')).rejects.toThrow(/Failed to fetch sample/);
  });
});
