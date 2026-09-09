/**
 * voiceManager.test.ts — 多声部、偷声优先级、同音重触发
 */

import { describe, expect, it } from 'vitest';

import type { SampleRegion } from '../SampleRegion';
import { VoiceManager } from '../VoiceManager';
import {
  FakeAudioBuffer,
  FakeAudioContext,
  FakeAudioNode,
  asAudioBuffer,
  asAudioContext,
  asAudioNode,
} from './mocks/fakeAudioContext';

function makeRegion(over: Partial<SampleRegion> = {}): SampleRegion {
  return {
    id: 'r',
    instrument: 'steel_acoustic',
    sampleRelPath: 'a.wav',
    sampleUrl: '/sounds/a.wav',
    keyLow: 0,
    keyHigh: 127,
    rootKey: 60,
    velocityLow: 1,
    velocityHigh: 127,
    gain: 1,
    transpose: 0,
    tune: 0,
    offset: 0,
    end: 0,
    loopMode: 'no_loop',
    loopStart: 0,
    loopEnd: 0,
    release: 0.3,
    alternateIndex: 0,
    muted: false,
    ...over,
  };
}

const BUFFER = asAudioBuffer(new FakeAudioBuffer(1, 48000, 48000));
const REGION = makeRegion();

function makeManager(maxVoices: number) {
  const ctx = new FakeAudioContext();
  const manager = new VoiceManager(
    asAudioContext(ctx),
    asAudioNode(new FakeAudioNode()),
    { maxVoices },
  );
  return { ctx, manager };
}

function startVoice(
  manager: VoiceManager,
  over: Partial<{ midiNote: number; string: number }> = {},
  when = 0,
) {
  const voice = manager.acquire({
    id: 0,
    midiNote: over.midiNote ?? 60,
    string: over.string ?? 0,
    fret: 0,
    velocity: 100,
    muted: false,
  });
  voice.startSample(when, BUFFER, REGION, 1, 0.8);
  return voice;
}

describe('多声部', () => {
  it('可同时持有 32 个 voice', () => {
    const { manager } = makeManager(32);
    for (let i = 0; i < 32; i++) startVoice(manager, { midiNote: 40 + i });

    expect(manager.activeCount).toBe(32);
    expect(manager.peak).toBe(32);
  });

  it('达到上限后再取 voice 会偷声，数量保持在上限', () => {
    const { manager } = makeManager(32);
    for (let i = 0; i < 32; i++) startVoice(manager, { midiNote: 40 + i });
    startVoice(manager, { midiNote: 90 });

    expect(manager.activeCount).toBe(32);
  });

  it('同一音高快速重复拨弦不会杀掉前一个 voice', () => {
    const { manager } = makeManager(8);
    const voices = [
      startVoice(manager, { midiNote: 64 }),
      startVoice(manager, { midiNote: 64 }),
      startVoice(manager, { midiNote: 64 }),
      startVoice(manager, { midiNote: 64 }),
    ];

    expect(manager.activeCount).toBe(4);
    for (const voice of voices) expect(voice.finished).toBe(false);
  });

  it('handleRetrigger 默认不干预（完全重叠）', () => {
    const { manager } = makeManager(8);
    const first = startVoice(manager, { midiNote: 64, string: 0 });
    const released = manager.handleRetrigger(64, 0, 0.1);

    expect(released).toBe(0);
    expect(first.releaseTime).toBeNull();
  });
});

describe('偷声优先级', () => {
  it('优先偷已进入 release 的 voice', () => {
    const { manager } = makeManager(3);
    const v1 = startVoice(manager, { midiNote: 60 });
    const v2 = startVoice(manager, { midiNote: 62 });
    const v3 = startVoice(manager, { midiNote: 64 });

    v2.release(0.1);
    expect(v2.state).toBe('release');

    startVoice(manager, { midiNote: 67 });

    expect(manager.all).not.toContain(v2);
    expect(manager.all).toContain(v1);
    expect(manager.all).toContain(v3);
  });

  it('没有 release 的 voice 时，偷最早启动的那个', () => {
    const { ctx, manager } = makeManager(3);
    const v1 = startVoice(manager, { midiNote: 60 }, 0);
    const v2 = startVoice(manager, { midiNote: 62 }, 0.1);
    const v3 = startVoice(manager, { midiNote: 64 }, 0.2);

    // 让三个 voice 都已真正开始发声（否则会被当成"可自由取消的排程 voice"）
    ctx.currentTime = 1;
    startVoice(manager, { midiNote: 67 }, 1);

    expect(manager.all).not.toContain(v1);
    expect(manager.all).toContain(v2);
    expect(manager.all).toContain(v3);
  });
});

describe('释放', () => {
  it('releaseByMidi 只释放对应音高', () => {
    const { manager } = makeManager(8);
    const a = startVoice(manager, { midiNote: 60 });
    const b = startVoice(manager, { midiNote: 62 });

    const released = manager.releaseByMidi(60, 0.5);

    expect(released).toBe(1);
    expect(a.state).toBe('release');
    expect(b.state).toBe('sustain');
  });

  it('stopAll 会停止所有 voice 的音源', () => {
    const { manager } = makeManager(8);
    const voices = [startVoice(manager, { midiNote: 60 }), startVoice(manager, { midiNote: 62 })];

    manager.stopAll(0.1);

    for (const voice of voices) {
      expect(voice.scheduledStopTime).not.toBeNull();
    }
  });

  it('取消尚未开始的排程 voice', () => {
    const { manager } = makeManager(8);
    startVoice(manager, { midiNote: 60 }, 5); // 5 秒后才开始

    const cancelled = manager.cancelScheduled();

    expect(cancelled).toBe(1);
    expect(manager.activeCount).toBe(0);
  });
});
