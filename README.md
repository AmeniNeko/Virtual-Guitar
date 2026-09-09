# 🎸 Virtual Guitar

浏览器端虚拟吉他。演奏、和弦、音阶、录音、MIDI 导出。

音频层是基于 SFZ 的采样播放引擎：真实吉他采样、32 声部复音、低延迟、
自然衰减，UI 与音频引擎完全解耦。

## 快速开始

```bash
npm install
npm run dev
```

**采样音源需要单独安装**（约 1.3 GB，不进入 Git 仓库）。
请按 [THIRD_PARTY_SAMPLES.md](THIRD_PARTY_SAMPLES.md) 的说明下载四套 FreePats 音源，
解压到 `public/sounds/`。缺少音源时引擎会退化为合成音色，并在控制台给出提示。

## 技术栈

React 19 · TypeScript · Vite 8 · Web Audio API · Canvas 2D · Vitest

## 音频引擎

```
UI ──Pluck / Strum / NoteOn / NoteOff──▶ AudioEngine
                                           ├── SFZParser → SampleRegion
                                           ├── SampleCache（LRU，按需解码）
                                           ├── SampleResolver（键区 / 力度层 / 轮询）
                                           ├── VoiceManager（32 声部 + 偷声）
                                           └── EffectChain → 主输出 → 限幅
```

- **四套音色**：`steel_acoustic`、`nylon_classical`、`electric_clean`、`electric_overdrive`
- **按需加载**：启动只解析 SFZ 建立索引，WAV 在需要时才解码，LRU 缓存默认 256 MB
- **不猜采样映射**：音高、力度层、轮询全部来自 SFZ，引擎不做文件名猜测
- **音频时钟调度**：扫弦与和弦全部排在 `AudioContext.currentTime` 上，不使用 `setTimeout`

调试（仅开发模式）：

```js
AudioEngine.getStats()            // 声部数 / 缓存 / 命中率 / 乐器状态
AudioEngineTests.selfCheck()      // 校验四套 SFZ 的解析结果
AudioEngineTests.rapidRepeat(64)  // 快速重复拨弦测试
```

## 测试

```bash
npm test
```

## 功能

| 功能 | 说明 |
|------|------|
| **演奏** | 鼠标 / 键盘 / 触摸 / 扫弦 |
| **调弦** | Standard、Drop D、DADGAD 等 6 种预设 |
| **Capo** | 0-12 品，自动移调 |
| **和弦模式** | 140 种和弦 + 指法图 + 音程标签 |
| **音阶模式** | 9 种音阶 + 构成音显示 |
| **录音** | Note Event 录制 + 时间轴 + Undo/Redo |
| **MIDI 导出** | 标准 MIDI 1.0，可导入 DAW |
| **状态持久化** | localStorage + URL 分享 |

## 键盘映射

```
Q W E R T Y  →  1弦 0-5品
A S D F G H  →  2弦 0-5品
Z X C V B N  →  3弦 0-5品
1 2 3 4 5 6  →  4弦 0-5品
7 8 9 0 - =  →  5-6弦 0-3品
```

## 构建部署

```bash
npm run build    # 产物在 dist/
```

将 `dist/` 部署到任意静态托管（Vercel / Netlify / GitHub Pages）。

## License

MIT
