/**
 * fakeAudioContext.ts — 最小可用的 Web Audio 替身
 *
 * 只实现 Audio Engine 真正用到的接口，用于在 node 环境下测试
 * SampleCache / Voice / VoiceManager 的调度与生命周期逻辑。
 * 不做任何真实音频处理。
 */

export class FakeAudioParam {
  value = 0;
  events: { type: string; value: number; time: number }[] = [];

  setValueAtTime(value: number, time: number): this {
    this.events.push({ type: 'set', value, time });
    this.value = value;
    return this;
  }

  linearRampToValueAtTime(value: number, time: number): this {
    this.events.push({ type: 'linear', value, time });
    this.value = value;
    return this;
  }

  exponentialRampToValueAtTime(value: number, time: number): this {
    this.events.push({ type: 'exp', value, time });
    this.value = value;
    return this;
  }

  setTargetAtTime(value: number, time: number, timeConstant: number): this {
    this.events.push({ type: 'target', value, time });
    void timeConstant;
    this.value = value;
    return this;
  }

  cancelScheduledValues(time: number): this {
    this.events.push({ type: 'cancel', value: this.value, time });
    return this;
  }

  cancelAndHoldAtTime(time: number): this {
    this.events.push({ type: 'hold', value: this.value, time });
    return this;
  }
}

export class FakeAudioNode {
  outputs: FakeAudioNode[] = [];

  connect<T extends FakeAudioNode>(node: T): T {
    this.outputs.push(node as unknown as FakeAudioNode);
    return node;
  }

  disconnect(): void {
    this.outputs = [];
  }
}

export class FakeGainNode extends FakeAudioNode {
  gain = new FakeAudioParam();
}

export class FakeBiquadFilterNode extends FakeAudioNode {
  type = 'lowpass';
  frequency = new FakeAudioParam();
  Q = new FakeAudioParam();
  detune = new FakeAudioParam();
}

export class FakeBufferSourceNode extends FakeAudioNode {
  buffer: FakeAudioBuffer | null = null;
  playbackRate = new FakeAudioParam();
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  onended: (() => void) | null = null;
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  startOffset = 0;
  startDuration: number | undefined;

  start(when = 0, offset = 0, duration?: number): void {
    this.startedAt = when;
    this.startOffset = offset;
    this.startDuration = duration;
  }

  stop(when = 0): void {
    this.stoppedAt = when;
  }

  /** 测试辅助：模拟播放自然结束 */
  fireEnded(): void {
    this.onended?.();
  }
}

export class FakeAudioBuffer {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  duration: number;
  private channels: Float32Array[];

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }

  /** 必须返回同一个数组：真实实现也是持久的，写入要能读回来 */
  getChannelData(channel: number): Float32Array {
    return this.channels[channel];
  }
}

export class FakeAudioContext {
  currentTime = 0;
  sampleRate = 48000;
  state: 'running' | 'suspended' | 'closed' = 'running';
  sources: FakeBufferSourceNode[] = [];

  createGain(): FakeGainNode {
    return new FakeGainNode();
  }

  createBiquadFilter(): FakeBiquadFilterNode {
    return new FakeBiquadFilterNode();
  }

  createBufferSource(): FakeBufferSourceNode {
    const source = new FakeBufferSourceNode();
    this.sources.push(source);
    return source;
  }

  createBuffer(channels: number, length: number, sampleRate: number): FakeAudioBuffer {
    return new FakeAudioBuffer(channels, length, sampleRate);
  }

  async decodeAudioData(buffer: ArrayBuffer): Promise<FakeAudioBuffer> {
    // 用一个确定的映射让测试能预测字节数
    return new FakeAudioBuffer(2, buffer.byteLength, this.sampleRate);
  }

  async resume(): Promise<void> {
    this.state = 'running';
  }

  async close(): Promise<void> {
    this.state = 'closed';
  }
}

/** 把替身当作真实的 Web Audio 类型使用（仅限测试）。 */
export function asAudioContext(fake: FakeAudioContext): BaseAudioContext {
  return fake as unknown as BaseAudioContext;
}

export function asAudioBuffer(fake: FakeAudioBuffer): AudioBuffer {
  return fake as unknown as AudioBuffer;
}

export function asAudioNode(fake: FakeAudioNode): AudioNode {
  return fake as unknown as AudioNode;
}
