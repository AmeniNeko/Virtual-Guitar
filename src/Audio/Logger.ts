/**
 * Logger.ts — Audio Engine 调试输出
 *
 * 生产模式静默；`AudioEngine.debug = true` 打开详细日志。
 */

const PREFIX = '[AudioEngine]';

class Logger {
  enabled = false;

  log(...args: unknown[]): void {
    if (this.enabled) console.log(PREFIX, ...args);
  }

  warn(...args: unknown[]): void {
    // 警告始终输出：加载失败必须可见
    console.warn(PREFIX, ...args);
  }

  error(...args: unknown[]): void {
    console.error(PREFIX, ...args);
  }

  /** 格式化标准错误：Instrument / Sample / Path / Reason */
  fail(reason: string, detail: { instrument?: string; sample?: string; path?: string }): string {
    const parts = [reason];
    if (detail.instrument) parts.push(`Instrument: ${detail.instrument}`);
    if (detail.sample) parts.push(`Sample: ${detail.sample}`);
    if (detail.path) parts.push(`Path: ${detail.path}`);
    const message = parts.join('\n  ');
    this.error(message);
    return message;
  }
}

export const logger = new Logger();
