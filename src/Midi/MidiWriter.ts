/**
 * MidiWriter.ts — MIDI 文件生成器
 *
 * 生成标准 MIDI 1.0 文件（.mid）。
 * 支持：Header Chunk, Track Chunk, Tempo, Note On/Off, Velocity。
 *
 * MIDI 文件格式：
 * - Header: "MThd" + length(6) + format(0或1) + tracks + division
 * - Track:  "MTrk" + length + events...
 * - Event:  delta-time (VVLQ) + meta-event or MIDI-event
 */

import type { NoteEvent } from '../Recording/Recording';

// ─── MIDI 常量 ───────────────────────────────────────

const HEADER_CHUNK = 'MThd';
const TRACK_CHUNK = 'MTrk';

// ─── 变长量化 (VVLQ) ────────────────────────────────

/** 将整数编码为 MIDI 变长量化值 (VVLQ) */
function encodeVVLQ(value: number): number[] {
  if (value < 0) value = 0;
  const bytes: number[] = [];
  bytes.push(value & 0x7F);
  value >>= 7;
  while (value > 0) {
    bytes.push((value & 0x7F) | 0x80);
    value >>= 7;
  }
  return bytes.reverse();
}

// ─── 写入器 ──────────────────────────────────────────

class MidiBuffer {
  private data: number[] = [];

  writeByte(b: number): void {
    this.data.push(b & 0xFF);
  }

  writeBytes(bytes: number[]): void {
    for (const b of bytes) this.data.push(b & 0xFF);
  }

  writeString(s: string): void {
    for (let i = 0; i < s.length; i++) {
      this.data.push(s.charCodeAt(i) & 0xFF);
    }
  }

  writeUint16(value: number): void {
    this.data.push((value >> 8) & 0xFF);
    this.data.push(value & 0xFF);
  }

  writeUint32(value: number): void {
    this.data.push((value >> 24) & 0xFF);
    this.data.push((value >> 16) & 0xFF);
    this.data.push((value >> 8) & 0xFF);
    this.data.push(value & 0xFF);
  }

  writeVVLQ(value: number): void {
    this.writeBytes(encodeVVLQ(value));
  }

  getData(): Uint8Array {
    return new Uint8Array(this.data);
  }

  get length(): number {
    return this.data.length;
  }
}

// ─── MIDI 文件生成 ──────────────────────────────────

export interface MidiExportOptions {
  /** 事件列表 */
  events: NoteEvent[];
  /** BPM (默认 120) */
  bpm?: number;
  /** MIDI 通道 (0-15，默认 0) */
  channel?: number;
  /** 格式 (0=single track, 1=multi track) */
  format?: 0 | 1;
}

/**
 * 将 NoteEvent 转换为 MIDI ticks
 *
 * MIDI tick = (time_ms / 60000) * (bpm * ticks_per_beat)
 * ticks_per_beat = 480 (标准分辨率)
 */
function msToTicks(ms: number, bpm: number, ticksPerBeat: number = 480): number {
  return Math.round((ms / 60000) * bpm * ticksPerBeat);
}

/**
 * 生成 MIDI 文件数据
 */
export function generateMidi(options: MidiExportOptions): Uint8Array {
  const {
    events,
    bpm = 120,
    channel = 0,
    format = 0,
  } = options;

  const ticksPerBeat = 480;
  const trackBuffer = new MidiBuffer();

  // ── Track 事件 ──

  // Tempo meta event: FF 51 03 tttttt
  const microsecondsPerBeat = Math.round(60000000 / bpm);
  trackBuffer.writeVVLQ(0); // delta = 0
  trackBuffer.writeByte(0xFF);
  trackBuffer.writeByte(0x51);
  trackBuffer.writeByte(0x03);
  trackBuffer.writeByte((microsecondsPerBeat >> 16) & 0xFF);
  trackBuffer.writeByte((microsecondsPerBeat >> 8) & 0xFF);
  trackBuffer.writeByte(microsecondsPerBeat & 0xFF);

  // 按时间排序事件
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

  // 生成 Note On / Note Off 事件
  const midiEvents: Array<{
    tick: number;
    type: 'on' | 'off';
    note: number;
    velocity: number;
  }> = [];

  for (const event of sortedEvents) {
    const onTick = msToTicks(event.timestamp, bpm, ticksPerBeat);
    const offTick = msToTicks(event.timestamp + event.duration, bpm, ticksPerBeat);

    midiEvents.push({
      tick: onTick,
      type: 'on',
      note: event.midi,
      velocity: Math.round(event.velocity * 127),
    });

    midiEvents.push({
      tick: offTick,
      type: 'off',
      note: event.midi,
      velocity: 0,
    });
  }

  // 按 tick 排序
  midiEvents.sort((a, b) => a.tick - b.tick);

  // 写入 MIDI 事件
  let lastTick = 0;
  for (const evt of midiEvents) {
    const delta = evt.tick - lastTick;
    lastTick = evt.tick;

    trackBuffer.writeVVLQ(Math.max(0, delta));

    if (evt.type === 'on') {
      // Note On: 9x note velocity
      trackBuffer.writeByte(0x90 | channel);
      trackBuffer.writeByte(evt.note & 0x7F);
      trackBuffer.writeByte(evt.velocity & 0x7F);
    } else {
      // Note Off: 8x note 00
      trackBuffer.writeByte(0x80 | channel);
      trackBuffer.writeByte(evt.note & 0x7F);
      trackBuffer.writeByte(0x00);
    }
  }

  // End of Track
  trackBuffer.writeVVLQ(0);
  trackBuffer.writeBytes([0xFF, 0x2F, 0x00]);

  // ── Header Chunk ──
  const headerBuffer = new MidiBuffer();
  headerBuffer.writeString(HEADER_CHUNK);
  headerBuffer.writeUint32(6); // header length
  headerBuffer.writeUint16(format);
  headerBuffer.writeUint16(1); // number of tracks
  headerBuffer.writeUint16(ticksPerBeat);

  // ── Track Chunk ──
  const trackData = trackBuffer.getData();
  const trackChunkBuffer = new MidiBuffer();
  trackChunkBuffer.writeString(TRACK_CHUNK);
  trackChunkBuffer.writeUint32(trackData.length);
  trackChunkBuffer.writeBytes(Array.from(trackData));

  // ── 合并 ──
  const headerData = headerBuffer.getData();
  const trackChunkData = trackChunkBuffer.getData();
  const result = new Uint8Array(headerData.length + trackChunkData.length);
  result.set(headerData, 0);
  result.set(trackChunkData, headerData.length);

  return result;
}

/**
 * 触发浏览器下载 MIDI 文件
 */
export function downloadMidi(options: MidiExportOptions, filename: string = 'recording.mid'): void {
  const data = generateMidi(options);
  const buf = new ArrayBuffer(data.length);
  new Uint8Array(buf).set(data);
  const blob = new Blob([buf], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
