# 🎸 Virtual Guitar

浏览器端虚拟吉他。演奏、和弦、音阶、录音、MIDI 导出。

音频层是基于 SFZ 的采样播放引擎：真实吉他采样、32 声部复音、低延迟、
自然衰减，UI 与音频引擎完全解耦。

## 快速开始

```bash
npm install
npm run dev
```

**采样音源需要单独安装**（约 1.3 GB，不进入 Git 仓库）：

```bash
npm run fetch:samples     # 从 GitHub Release 下载并解压到 public/sounds/
```

也可以按 [THIRD_PARTY_SAMPLES.md](THIRD_PARTY_SAMPLES.md) 手动下载四套 FreePats 音源。
缺少音源时应用仍可运行，但会退化为合成音色，控制台会给出提示。

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

## 发行（维护者）

采样体积过大，不进入 Git 历史。测试版以**便携包**分发：一个 zip 里同时包含
程序和采样，下载解压后双击 `start.bat`（或 `./start.sh`）即可运行。

```bash
npm run fetch:samples     # 1. 安装采样（仅首次需要）
npm run build             # 2. 构建（public/sounds 会被复制进 dist/）
npm run pack:portable     # 3. 产出 dist-samples/VirtualGuitar-v<版本>-portable.zip
```

把该 zip 上传到 GitHub Release 即可。用户不需要装 Node 之外的东西——
便携包自带一个本地静态服务器（`server.mjs`），因为浏览器禁止 `file://`
页面加载采样。

需要单独分发采样包（给跑源码的人）时：

```bash
npm run pack:samples      # → dist-samples/<id>.zip，并输出每个包的 sha256
```

发布新版本时，记得同步 `scripts/fetch-samples.mjs` 顶部的 `DEFAULT_RELEASE_URL`。

## License

MIT
