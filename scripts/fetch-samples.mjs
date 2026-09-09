#!/usr/bin/env node
/**
 * fetch-samples.mjs — 从 GitHub Release 下载采样包并解压到 public/sounds/
 *
 * 用法：
 *   npm run fetch:samples
 *   RELEASE_URL=https://github.com/<user>/<repo>/releases/download/v0.2 npm run fetch:samples
 *   npm run fetch:samples -- --force     # 已安装的也重新下载
 *
 * 只会从你配置的地址下载（默认是本项目自己的 Release）。
 * 不会自动从第三方站点抓取音源 —— 那既不合法也不可靠。
 */

import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/** 默认下载地址；发布新版本时改这里，或用 RELEASE_URL 环境变量覆盖。 */
const DEFAULT_RELEASE_URL =
  'https://github.com/AmeniNeko/Virtual-Guitar/releases/download/v0.2';

const RELEASE_URL = (process.env.RELEASE_URL ?? DEFAULT_RELEASE_URL).replace(/\/$/, '');

const ROOT = resolve(import.meta.dirname, '..');
/** 默认装到 public/sounds/；SAMPLES_DIR 可覆盖（自定义位置或测试用）。 */
const SOUNDS_DIR = process.env.SAMPLES_DIR
  ? resolve(process.env.SAMPLES_DIR)
  : join(ROOT, 'public', 'sounds');
const TMP_DIR = join(ROOT, 'node_modules', '.tmp', 'samples');
const MANIFEST_PATH = join(ROOT, 'samples.manifest.json');

function fail(message) {
  console.error(`\n[fetch-samples] ${message}\n`);
  process.exit(1);
}

/** Windows 自带 bsdtar；Git Bash 的 GNU tar 读不了 zip，必须用绝对路径定位。 */
function findBsdtar() {
  if (process.platform !== 'win32') return null;
  const candidate = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
  return existsSync(candidate) ? candidate : null;
}

function unzipTo(zipPath, destDir) {
  const bsdtar = findBsdtar();

  if (bsdtar) {
    execFileSync(bsdtar, ['-x', '-f', zipPath, '-C', destDir], { stdio: 'inherit' });
    return;
  }

  if (process.platform === 'win32') {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destDir}' -Force`,
      ],
      { stdio: 'inherit' },
    );
    return;
  }

  execFileSync('unzip', ['-o', '-q', zipPath, '-d', destDir], { stdio: 'inherit' });
}

async function download(url, destFile) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  if (!response.body) throw new Error('响应没有内容');

  await pipeline(Readable.fromWeb(response.body), createWriteStream(destFile));
}

if (!existsSync(MANIFEST_PATH)) fail(`找不到 ${MANIFEST_PATH}`);

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
mkdirSync(SOUNDS_DIR, { recursive: true });
mkdirSync(TMP_DIR, { recursive: true });

console.log(`[fetch-samples] 来源：${RELEASE_URL}\n`);

const force = process.argv.includes('--force');
let installed = 0;
let failed = 0;

for (const pack of manifest.packs) {
  const target = join(SOUNDS_DIR, pack.directory);

  if (existsSync(target) && !force) {
    console.log(`跳过 ${pack.id}（已安装，加 --force 可重新下载）`);
    continue;
  }

  const zipName = `${pack.id}.zip`;
  const zipPath = join(TMP_DIR, zipName);
  const url = `${RELEASE_URL}/${zipName}`;

  process.stdout.write(`下载 ${pack.id} … `);
  try {
    await download(url, zipPath);
  } catch (error) {
    failed++;
    console.log('失败');
    console.error(
      `  ${url}\n  ${error instanceof Error ? error.message : String(error)}\n` +
        '  请确认该 Release 已发布，或用 RELEASE_URL 指定正确地址。',
    );
    continue;
  }
  console.log('完成');

  process.stdout.write(`解压 ${basename(zipPath)} … `);
  unzipTo(zipPath, SOUNDS_DIR);
  rmSync(zipPath, { force: true });
  console.log('完成');
  installed++;
}

rmSync(TMP_DIR, { recursive: true, force: true });

console.log(`\n=== 完成：安装 ${installed} 个，失败 ${failed} 个 ===`);
console.log('启动应用后，在浏览器控制台执行 AudioEngineTests.selfCheck() 可确认解析结果。');
console.log('若某个音源仍缺失，引擎会退回合成器音色并在控制台给出提示。');
