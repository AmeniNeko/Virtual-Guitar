/**
 * wavMetadata.test.ts — WAV 头解析与 24-bit 手动解码
 *
 * 重点覆盖本项目电吉他音源的真实格式：
 * 24-bit 立体声 48kHz、WAVE_FORMAT_EXTENSIBLE（fmt 块 40 字节）。
 */

import { describe, expect, it } from 'vitest';

import {
  WAVE_FORMAT_EXTENSIBLE,
  WAVE_FORMAT_PCM,
  decodeWavToAudioBuffer,
  parseWavHeader,
} from '../WavMetadata';
import { FakeAudioContext, asAudioContext } from './mocks/fakeAudioContext';

interface BuildWavOptions {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  frames: number;
  formatTag?: number;
  extensible?: boolean;
  /** 在 data 之前插入一个 LIST chunk，验证不是按固定偏移解析 */
  insertListChunk?: boolean;
  writeSample?: (view: DataView, offset: number, frame: number, channel: number) => void;
}

function buildWav(options: BuildWavOptions): ArrayBuffer {
  const {
    channels,
    sampleRate,
    bitsPerSample,
    frames,
    formatTag = WAVE_FORMAT_PCM,
    extensible = false,
    insertListChunk = false,
    writeSample,
  } = options;

  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const dataLength = frames * blockAlign;
  const fmtSize = extensible ? 40 : 16;
  const listSize = insertListChunk ? 8 : 0;
  const total = 12 + (8 + fmtSize) + listSize + (8 + dataLength);

  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, total - 8, true);
  writeAscii(8, 'WAVE');

  let offset = 12;
  writeAscii(offset, 'fmt ');
  view.setUint32(offset + 4, fmtSize, true);
  view.setUint16(offset + 8, extensible ? WAVE_FORMAT_EXTENSIBLE : formatTag, true);
  view.setUint16(offset + 10, channels, true);
  view.setUint32(offset + 12, sampleRate, true);
  view.setUint32(offset + 16, sampleRate * blockAlign, true);
  view.setUint16(offset + 20, blockAlign, true);
  view.setUint16(offset + 22, bitsPerSample, true);

  if (extensible) {
    view.setUint16(offset + 24, 22, true); // cbSize
    view.setUint16(offset + 26, bitsPerSample, true); // validBitsPerSample
    view.setUint32(offset + 28, 0, true); // channelMask
    // subFormat GUID：前两字节是真实格式
    view.setUint16(offset + 32, formatTag, true);
  }
  offset += 8 + fmtSize;

  if (insertListChunk) {
    writeAscii(offset, 'LIST');
    view.setUint32(offset + 4, 0, true);
    offset += 8;
  }

  writeAscii(offset, 'data');
  view.setUint32(offset + 4, dataLength, true);
  const dataOffset = offset + 8;

  if (writeSample) {
    for (let frame = 0; frame < frames; frame++) {
      for (let channel = 0; channel < channels; channel++) {
        writeSample(view, dataOffset + frame * blockAlign + channel * bytesPerSample, frame, channel);
      }
    }
  }

  return buffer;
}

describe('parseWavHeader', () => {
  it('解析 16-bit 单声道 PCM', () => {
    const info = parseWavHeader(buildWav({ channels: 1, sampleRate: 44100, bitsPerSample: 16, frames: 4410 }));

    expect(info).not.toBeNull();
    expect(info?.formatTag).toBe(WAVE_FORMAT_PCM);
    expect(info?.channels).toBe(1);
    expect(info?.sampleRate).toBe(44100);
    expect(info?.bitsPerSample).toBe(16);
    expect(info?.frames).toBe(4410);
    expect(info?.duration).toBeCloseTo(0.1, 6);
  });

  it('解析 24-bit 立体声 WAVE_FORMAT_EXTENSIBLE（电吉他音源的真实格式）', () => {
    const info = parseWavHeader(
      buildWav({
        channels: 2,
        sampleRate: 48000,
        bitsPerSample: 24,
        frames: 48000,
        formatTag: WAVE_FORMAT_PCM,
        extensible: true,
      }),
    );

    expect(info?.formatTag).toBe(WAVE_FORMAT_PCM); // EXTENSIBLE 被子格式替换
    expect(info?.channels).toBe(2);
    expect(info?.bitsPerSample).toBe(24);
    expect(info?.duration).toBeCloseTo(1, 6);
  });

  it('扫描 chunk 而不是假设固定的 44 字节头', () => {
    const info = parseWavHeader(
      buildWav({
        channels: 1,
        sampleRate: 44100,
        bitsPerSample: 16,
        frames: 100,
        insertListChunk: true,
      }),
    );

    expect(info?.frames).toBe(100);
    expect(info?.dataOffset).toBeGreaterThan(44);
  });

  it('非 WAV 数据返回 null 而不是抛异常', () => {
    expect(parseWavHeader(new ArrayBuffer(4))).toBeNull();
  });
});

describe('decodeWavToAudioBuffer（原生解码失败时的回退路径）', () => {
  it('正确解码 24-bit 有符号 PCM', () => {
    const ctx = asAudioContext(new FakeAudioContext());
    const wav = buildWav({
      channels: 1,
      sampleRate: 48000,
      bitsPerSample: 24,
      frames: 3,
      writeSample: (view, offset, frame) => {
        if (frame === 0) {
          view.setUint8(offset, 0x00);
          view.setUint8(offset + 1, 0x00);
          view.setUint8(offset + 2, 0x00); // 0
        } else if (frame === 1) {
          view.setUint8(offset, 0xff);
          view.setUint8(offset + 1, 0xff);
          view.setUint8(offset + 2, 0x7f); // +max
        } else {
          view.setUint8(offset, 0x00);
          view.setUint8(offset + 1, 0x00);
          view.setUint8(offset + 2, 0x80); // -max
        }
      },
    });

    const decoded = decodeWavToAudioBuffer(ctx, wav);
    expect(decoded).not.toBeNull();

    const channel = decoded!.getChannelData(0);
    expect(channel[0]).toBeCloseTo(0, 6);
    expect(channel[1]).toBeCloseTo(1, 4);
    expect(channel[2]).toBeCloseTo(-1, 6);
  });

  it('解码 16-bit PCM', () => {
    const ctx = asAudioContext(new FakeAudioContext());
    const wav = buildWav({
      channels: 1,
      sampleRate: 44100,
      bitsPerSample: 16,
      frames: 2,
      writeSample: (view, offset, frame) => {
        view.setInt16(offset, frame === 0 ? 0 : 16384, true);
      },
    });

    const decoded = decodeWavToAudioBuffer(ctx, wav);
    expect(decoded!.getChannelData(0)[1]).toBeCloseTo(0.5, 6);
  });

  it('不支持的位深返回 null', () => {
    const ctx = asAudioContext(new FakeAudioContext());
    // 64-bit 既不是整数 PCM 也不是 32-bit float
    const wav = buildWav({ channels: 1, sampleRate: 44100, bitsPerSample: 64, frames: 4 });

    expect(decodeWavToAudioBuffer(ctx, wav)).toBeNull();
  });
});
