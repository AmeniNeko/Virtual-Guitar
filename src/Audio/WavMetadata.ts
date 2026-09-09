/**
 * WavMetadata.ts — WAV 头解析 + 24-bit 手动解码回退
 *
 * 两个职责：
 * 1. 扫描 RIFF chunk 读取元数据（不依赖固定的 44 字节布局）
 * 2. 当原生 decodeAudioData 失败时，手动把 PCM 转成 AudioBuffer
 *
 * 本项目的电吉他音源是 24-bit WAVE_FORMAT_EXTENSIBLE（fmt 块 40 字节、
 * formatTag 0xFFFE），Safari 的 decodeAudioData 对其支持不可靠，故保留回退路径。
 */

export const WAVE_FORMAT_PCM = 0x0001;
export const WAVE_FORMAT_FLOAT = 0x0003;
export const WAVE_FORMAT_EXTENSIBLE = 0xfffe;

export interface WavInfo {
  /** 真实格式：PCM=1 / FLOAT=3（EXTENSIBLE 会被解析为子格式） */
  formatTag: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  blockAlign: number;
  dataOffset: number;
  dataLength: number;
  frames: number;
  duration: number;
  /** smpl chunk 中的 MIDIUnityNote，缺失则 undefined */
  rootKey?: number;
}

function fourCC(view: DataView, offset: number): string {
  return (
    String.fromCharCode(view.getUint8(offset)) +
    String.fromCharCode(view.getUint8(offset + 1)) +
    String.fromCharCode(view.getUint8(offset + 2)) +
    String.fromCharCode(view.getUint8(offset + 3))
  );
}

/** 解析 WAV 头。无法解析时返回 null（不抛异常）。 */
export function parseWavHeader(buffer: ArrayBuffer): WavInfo | null {
  if (buffer.byteLength < 12) return null;
  const view = new DataView(buffer);
  if (fourCC(view, 0) !== 'RIFF' || fourCC(view, 8) !== 'WAVE') return null;

  let offset = 12;
  let formatTag = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let blockAlign = 0;
  let dataOffset = -1;
  let dataLength = 0;
  let rootKey: number | undefined;

  while (offset + 8 <= buffer.byteLength) {
    const id = fourCC(view, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;

    if (id === 'fmt ') {
      if (body + 16 > buffer.byteLength) return null;
      formatTag = view.getUint16(body, true);
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      blockAlign = view.getUint16(body + 12, true);
      bitsPerSample = view.getUint16(body + 14, true);
      if (formatTag === WAVE_FORMAT_EXTENSIBLE && body + 26 <= buffer.byteLength) {
        // cbSize(2) + validBits(2) + channelMask(4) + subFormat GUID(16)
        formatTag = view.getUint16(body + 24, true);
      }
    } else if (id === 'data') {
      dataOffset = body;
      dataLength = Math.min(size, buffer.byteLength - body);
    } else if (id === 'smpl' && body + 20 <= buffer.byteLength) {
      rootKey = view.getUint32(body + 12, true);
    }

    // chunk 长度为奇数时补一个填充字节
    offset = body + size + (size & 1);
  }

  if (dataOffset < 0 || channels === 0 || sampleRate === 0) return null;

  const bytesPerFrame = blockAlign || (channels * bitsPerSample) / 8;
  const frames = bytesPerFrame > 0 ? Math.floor(dataLength / bytesPerFrame) : 0;

  return {
    formatTag,
    channels,
    sampleRate,
    bitsPerSample,
    blockAlign: bytesPerFrame,
    dataOffset,
    dataLength,
    frames,
    duration: sampleRate > 0 ? frames / sampleRate : 0,
    rootKey,
  };
}

/**
 * 手动把 PCM WAV 解码为 AudioBuffer。
 * 仅支持未压缩的 16/24/32-bit int 与 32-bit float，失败返回 null。
 */
export function decodeWavToAudioBuffer(
  ctx: BaseAudioContext,
  buffer: ArrayBuffer,
): AudioBuffer | null {
  const info = parseWavHeader(buffer);
  if (!info || info.frames <= 0) return null;

  const { formatTag, channels, bitsPerSample, frames } = info;
  if (formatTag !== WAVE_FORMAT_PCM && formatTag !== WAVE_FORMAT_FLOAT) return null;

  const bytesPerSample = bitsPerSample / 8;
  if (![1, 2, 3, 4].includes(bytesPerSample)) return null;

  const view = new DataView(buffer);
  const audioBuffer = ctx.createBuffer(channels, frames, info.sampleRate);
  const base = info.dataOffset;

  for (let ch = 0; ch < channels; ch++) {
    const out = audioBuffer.getChannelData(ch);
    const channelOffset = base + ch * bytesPerSample;
    const stride = info.blockAlign;

    for (let i = 0; i < frames; i++) {
      const p = channelOffset + i * stride;
      if (p + bytesPerSample > buffer.byteLength) break;

      let sample: number;
      if (formatTag === WAVE_FORMAT_FLOAT && bitsPerSample === 32) {
        sample = view.getFloat32(p, true);
      } else if (bitsPerSample === 16) {
        sample = view.getInt16(p, true) / 32768;
      } else if (bitsPerSample === 24) {
        // 24-bit 小端有符号：低字节在前的三字节组合
        const lo = view.getUint8(p);
        const mid = view.getUint8(p + 1);
        const hi = view.getInt8(p + 2);
        sample = ((hi << 16) | (mid << 8) | lo) / 8388608;
      } else if (bitsPerSample === 32) {
        sample = view.getInt32(p, true) / 2147483648;
      } else {
        // 8-bit PCM 为无符号
        sample = (view.getUint8(p) - 128) / 128;
      }

      out[i] = sample;
    }
  }

  return audioBuffer;
}
