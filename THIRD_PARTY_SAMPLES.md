# 第三方采样资源

本项目使用的全部采样均来自 [FreePats](http://freepats.zenvoid.org/) 项目，
以 CC0 公有领域贡献或 GPLv3+特殊例外发布。**不包含** Kontakt 8 Session Guitarist、
Ample Guitar 或任何其他商业音源库的采样文件。

采样文件不进入 Git 仓库（见 `.gitignore` 与 `samples.manifest.json`），
需要按下方说明自行下载并放入 `public/sounds/`。

---

## 1. FSS Steel String Guitar

| 项目 | 内容 |
|---|---|
| 名称 | FSS Steel String Guitar |
| 采样来源 | "FS Seagull Steel String Acoustic Guitar" by FlameStudios |
| 汇编 / 后期 | roberto@zenvoid.org（FreePats 项目） |
| 版本 | 2020-05-21 |
| 许可 | GPL-3.0-or-later with FreePats special exception |
| 原始地址 | http://freepats.zenvoid.org/Guitar/steel-acoustic-guitar.html#FSS |
| 本地目录 | `public/sounds/FSS-SteelStringGuitar-SFZ-20200521/` |
| 文件 | SFZ 1 个，WAV 59 个（16-bit mono 44.1kHz，约 25 MB） |
| 可否再分发 | 可以，需保留 GPLv3 与 FreePats 特殊例外声明 |

版权：Copyright 2008 Gary Campion，2016-2020 由 roberto@zenvoid.org 为 FreePats 修改。

**特殊例外**：以这些声音创作的作品，若只是混入这些声音或其未修改的部分，
不会因此被 GPL 覆盖。该例外不使作品的其他部分免于 GPL。

许可证全文见 `public/sounds/FSS-SteelStringGuitar-SFZ-20200521/.../gpl.txt`。

## 2. Spanish Classical Guitar

| 项目 | 内容 |
|---|---|
| 名称 | Spanish classical guitar |
| 作者 | roberto@zenvoid.org（FreePats 项目），2008 年录制 |
| 版本 | 2019-06-18 |
| 许可 | CC0-1.0（公有领域贡献） |
| 原始地址 | http://freepats.zenvoid.org/Guitar/acoustic-guitar.html |
| 本地目录 | `public/sounds/SpanishClassicalGuitar-SFZ-20190618/` |
| 文件 | SFZ 1 个，WAV 48 个（16-bit mono 44.1kHz，约 19 MB） |
| 可否再分发 | 可以，CC0 无限制 |

## 3. Electric Guitar FSBS (clean)

| 项目 | 内容 |
|---|---|
| 名称 | Electric Guitar FSBS (clean) |
| 作者 | roberto@zenvoid.org（FreePats 项目） |
| 版本 | 2026-08-07 |
| 许可 | CC0-1.0 |
| 原始地址 | http://freepats.zenvoid.org/ElectricGuitar/clean-electric-guitar.html |
| 本地目录 | `public/sounds/EGuitarFSBS-clean-SFZ+WAV-20260807/` |
| 文件 | SFZ 1 个，WAV 122 个（24-bit stereo 48kHz，约 642 MB） |
| 可否再分发 | 可以，CC0 无限制 |

信号链说明：采样由 Fender 电吉他直接录制后，经音箱与效果器机架处理成 clean 音色。
因此引擎**不再叠加** distortion（见 `src/Audio/InstrumentPreset.ts`）。

## 4. Electric Guitar FSBS (dist1)

| 项目 | 内容 |
|---|---|
| 名称 | Electric Guitar FSBS bridge pickups (dist1) |
| 作者 | roberto@zenvoid.org（FreePats 项目） |
| 版本 | 2022-09-11 |
| 许可 | CC0-1.0 |
| 原始地址 | http://freepats.zenvoid.org/ElectricGuitar/distorted-electric-guitar.html |
| 本地目录 | `public/sounds/EGuitarFSBS-dist1-SFZ+WAV-20220911/` |
| 文件 | SFZ 1 个，WAV 122 个（24-bit stereo 48kHz，约 631 MB） |
| 可否再分发 | 可以，CC0 无限制 |

信号链说明：采样本身已是 overdrive 音色，引擎只做轻度 EQ。

---

## 安装

```bash
# 1. 从上面的原始地址下载四个音源包
# 2. 解压后放入 public/sounds/，保持目录名不变
# 3. 启动应用，引擎会自动扫描并识别
npm run dev
```

目录结构应为：

```
public/sounds/
├── FSS-SteelStringGuitar-SFZ-20200521/
├── SpanishClassicalGuitar-SFZ-20190618/
├── EGuitarFSBS-clean-SFZ+WAV-20260807/
└── EGuitarFSBS-dist1-SFZ+WAV-20220911/
```

在浏览器控制台执行 `AudioEngineTests.selfCheck()` 可确认四个音源是否被正确解析。
`AudioEngine.checkSamplePacks()` 只返回每个音源的 `installed | missing | unknown` 状态，
不会自动下载任何第三方资源。

## 修改记录

本项目**不修改**任何原始音源文件。SFZ 与 WAV 均按下载时的原样使用；
所有乐器差异通过 `src/Audio/InstrumentAdapter.ts` 的规范化层表达。
如需转换，请输出到独立的 `processed/` 目录并保留转换脚本。
