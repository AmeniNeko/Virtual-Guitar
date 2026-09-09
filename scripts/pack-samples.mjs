#!/usr/bin/env node
/**
 * pack-samples.mjs — 把四套音源打包成 zip，用于 GitHub Release 附件
 *
 * 用法：
 *   npm run pack:samples
 *
 * 产物：dist-samples/<preset-id>.zip
 *   - 每个包 < 700MB，远低于 GitHub Release 的 2GB/文件上限
 *   - 同时输出体积与 sha256，方便写进 Release 说明供用户校验
 *
 * 注意：压缩不会显著减小体积（WAV 压缩率有限），打包只是为了
 * 变成一个可直接下载的文件。
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  statSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SOUNDS_DIR = join(ROOT, 'public', 'sounds');
const OUT_DIR = join(ROOT, 'dist-samples');
const MANIFEST_PATH = join(ROOT, 'samples.manifest.json');

function fail(message) {
  console.error(`\n[pack-samples] ${message}\n`);
  process.exit(1);
}

/**
 * Windows 自带的 bsdtar 能直接写 zip。
 *
 * 必须用绝对路径定位它：Git Bash / MSYS 的 PATH 里是 GNU tar，
 * 而 `GNU tar -a -c -f x.zip` 会**静默地写出一个 tar 文件**（文件头不是 PK），
 * 既不报错也不是 zip —— 靠"失败就回退"根本防不住。
 */
function findBsdtar() {
  if (process.platform !== 'win32') return null;
  const candidate = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
  return existsSync(candidate) ? candidate : null;
}

function zipDirectory(sourceDir, destZip) {
  const parent = dirname(sourceDir);
  const folder = basename(sourceDir);
  const bsdtar = findBsdtar();

  if (bsdtar) {
    execFileSync(bsdtar, ['-a', '-c', '-f', destZip, '-C', parent, folder], { stdio: 'inherit' });
    return;
  }

  if (process.platform === 'win32') {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -LiteralPath '${sourceDir}' -DestinationPath '${destZip}' -Force`,
      ],
      { stdio: 'inherit' },
    );
    return;
  }

  execFileSync('zip', ['-r', '-q', destZip, folder], { cwd: parent, stdio: 'inherit' });
}

/** 校验文件头确实是 PK（zip）。防止再次生成"扩展名是 zip 的 tar"。 */
function assertRealZip(filePath) {
  const fd = openSync(filePath, 'r');
  try {
    const head = Buffer.alloc(2);
    readSync(fd, head, 0, 2, 0);
    if (head[0] !== 0x50 || head[1] !== 0x4b) {
      fail(`${basename(filePath)} 不是合法的 zip（文件头为 ${head.toString('hex')}）`);
    }
  } finally {
    closeSync(fd);
  }
}

function sha256(filePath) {
  return new Promise((res, rej) => {
    const hash = createHash('sha256');
    createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => res(hash.digest('hex')))
      .on('error', rej);
  });
}

function formatBytes(bytes) {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

if (!existsSync(SOUNDS_DIR)) {
  fail(`找不到采样目录：${SOUNDS_DIR}\n请先把四套音源放入 public/sounds/`);
}
if (!existsSync(MANIFEST_PATH)) {
  fail(`找不到 ${MANIFEST_PATH}`);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
mkdirSync(OUT_DIR, { recursive: true });

console.log(`[pack-samples] 输出目录：${OUT_DIR}\n`);

const results = [];

for (const pack of manifest.packs) {
  const sourceDir = join(SOUNDS_DIR, pack.directory);
  const destZip = join(OUT_DIR, `${pack.id}.zip`);

  if (!existsSync(sourceDir)) {
    console.warn(`跳过 ${pack.id}：缺少 ${pack.directory}`);
    continue;
  }

  if (existsSync(destZip)) rmSync(destZip);

  process.stdout.write(`打包 ${pack.id} … `);
  zipDirectory(sourceDir, destZip);
  assertRealZip(destZip);

  const bytes = statSync(destZip).size;
  const hash = await sha256(destZip);
  results.push({ id: pack.id, name: pack.name, file: basename(destZip), bytes, hash });
  console.log(formatBytes(bytes));
}

if (results.length === 0) fail('没有打包出任何文件');

console.log('\n=== 完成 ===\n');
for (const r of results) {
  console.log(`${r.id}\n  ${r.file}  ${formatBytes(r.bytes)}\n  sha256: ${r.hash}\n`);
}

console.log('下一步：');
console.log('  1. GitHub → Releases → Draft a new release');
console.log('  2. 选择 tag（例如 v0.2），把 dist-samples/ 里的 zip 全部拖进附件区');
console.log('  3. 把上面的 sha256 贴进 Release 说明');
console.log('  4. Publish release 后，别人执行 npm run fetch:samples 即可自动安装');
