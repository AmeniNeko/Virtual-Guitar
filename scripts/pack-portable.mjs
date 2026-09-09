#!/usr/bin/env node
/**
 * pack-portable.mjs — 打包"一次下载就能用"的便携版
 *
 * 用法：
 *   npm run build            # 先构建（会把 public/sounds 复制进 dist/）
 *   npm run pack:portable
 *
 * 产物：dist-samples/VirtualGuitar-v<版本>-portable.zip
 *   解压后包含：构建好的应用 + 四套采样 + 启动脚本 + 许可说明。
 *   用户双击 start.bat（或 ./start.sh）即可运行。
 *
 * 与 pack:samples 的区别：
 *   pack:samples  → 四个采样包，给已经在跑源码的人用
 *   pack:portable → 单个完整发行包，给只想用的人用
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST_DIR = join(ROOT, 'dist');
const OUT_DIR = join(ROOT, 'dist-samples');
const PORTABLE_FILES_DIR = join(ROOT, 'scripts', 'portable');

function fail(message) {
  console.error(`\n[pack-portable] ${message}\n`);
  process.exit(1);
}

/** Windows 自带 bsdtar；Git Bash 的 GNU tar 会静默把 zip 写成 tar。 */
function findBsdtar() {
  if (process.platform !== 'win32') return null;
  const candidate = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
  return existsSync(candidate) ? candidate : null;
}

function zipDirectory(sourceDir, destZip) {
  const bsdtar = findBsdtar();

  if (bsdtar) {
    // `-C dir .` 让压缩包内条目位于根层级，解压即得完整目录
    execFileSync(bsdtar, ['-a', '-c', '-f', destZip, '-C', sourceDir, '.'], { stdio: 'inherit' });
    return;
  }
  if (process.platform === 'win32') {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${destZip}' -Force`,
      ],
      { stdio: 'inherit' },
    );
    return;
  }
  execFileSync('zip', ['-r', '-q', destZip, '.'], { cwd: sourceDir, stdio: 'inherit' });
}

function assertRealZip(filePath) {
  const fd = openSync(filePath, 'r');
  try {
    const head = Buffer.alloc(2);
    readSync(fd, head, 0, 2, 0);
    if (head[0] !== 0x50 || head[1] !== 0x4b) {
      fail(`${basename(filePath)} 不是合法的 zip（文件头 ${head.toString('hex')}）`);
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

// ── 前置检查 ──────────────────────────────────────────

if (!existsSync(join(DIST_DIR, 'index.html'))) {
  fail('找不到 dist/index.html，请先执行 npm run build');
}
if (!existsSync(join(DIST_DIR, 'sounds'))) {
  fail(
    'dist/sounds 不存在 —— 构建时 public/sounds 为空。\n' +
      '请先安装采样（npm run fetch:samples），再执行 npm run build。',
  );
}
if (!existsSync(PORTABLE_FILES_DIR)) {
  fail(`找不到启动器模板目录：${PORTABLE_FILES_DIR}`);
}

const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const zipName = `VirtualGuitar-v${version}-portable.zip`;
const destZip = join(OUT_DIR, zipName);

// ── 把启动器与许可说明放进 dist/ ──────────────────────

const added = [];

for (const file of readdirSync(PORTABLE_FILES_DIR)) {
  const source = join(PORTABLE_FILES_DIR, file);
  const target = join(DIST_DIR, file);

  if (file.endsWith('.bat')) {
    // Windows 批处理必须用 CRLF 行尾：LF-only 的 .bat 在 goto / 多行 if 块中会出错
    const text = readFileSync(source, 'utf8').replace(/\r?\n/g, '\r\n');
    writeFileSync(target, text, 'utf8');
  } else {
    copyFileSync(source, target);
  }

  added.push(file);
}

const licenseFile = 'THIRD_PARTY_SAMPLES.md';
if (existsSync(join(ROOT, licenseFile))) {
  copyFileSync(join(ROOT, licenseFile), join(DIST_DIR, licenseFile));
  added.push(licenseFile);
}

// ── 打包 ──────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true });
if (existsSync(destZip)) rmSync(destZip);

console.log(`[pack-portable] 打包 ${zipName}（约 1.3 GB，请稍候）…\n`);
zipDirectory(DIST_DIR, destZip);
assertRealZip(destZip);

// ── 清理临时放进 dist/ 的文件 ─────────────────────────

for (const file of added) rmSync(join(DIST_DIR, file), { force: true });

// ── 报告 ──────────────────────────────────────────────

const bytes = statSync(destZip).size;
const hash = await sha256(destZip);

console.log('\n=== 完成 ===\n');
console.log(`  ${zipName}`);
console.log(`  ${(bytes / 1048576).toFixed(1)} MB`);
console.log(`  sha256: ${hash}`);
console.log('');
console.log('包内结构：');
console.log('  index.html / assets/      构建好的应用');
console.log('  sounds/                   四套采样（约 1.3 GB）');
console.log('  start.bat / start.sh      启动脚本');
console.log('  server.mjs                本地静态服务器');
console.log('  README.txt / THIRD_PARTY_SAMPLES.md');
console.log('');
console.log('下一步：');
console.log('  1. GitHub → Releases → Draft a new release，选 tag v' + version);
console.log(`  2. 上传 dist-samples/${zipName}`);
console.log('  3. 把上面的 sha256 贴进 Release 说明');
console.log('  4. 用户下载解压后双击 start.bat 即可使用');
