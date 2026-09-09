# 🎸 Virtual Guitar

浏览器端虚拟吉他。演奏、和弦、音阶、录音、MIDI 导出，零外部音频依赖。

## 快速开始

```bash
npm install
npm run dev
```

## 技术栈

React 19 · TypeScript · Vite 8 · Web Audio API · Canvas 2D

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
