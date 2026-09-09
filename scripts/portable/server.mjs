#!/usr/bin/env node
/**
 * server.mjs — 便携版自带的本地静态服务器
 *
 * 浏览器不允许从 file:// 加载 ES 模块和采样（CORS），
 * 所以便携包必须通过 HTTP 打开，而不是双击 index.html。
 *
 * 用法：node server.mjs [端口]
 */

import { exec } from 'node:child_process';
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8080);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.sfz': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

const server = createServer((req, res) => {
  const rawPath = (req.url ?? '/').split('?')[0];

  // 必须完整解码：音源文件名里有 `#`（如 C#4_s5_01.wav），
  // 不解码就会 404。
  let pathname;
  try {
    pathname = decodeURIComponent(rawPath);
  } catch {
    pathname = rawPath;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';

  const filePath = normalize(join(ROOT, pathname));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let stat;
  try {
    stat = statSync(filePath);
  } catch {
    res.writeHead(404).end('Not Found');
    return;
  }
  if (!stat.isFile()) {
    res.writeHead(404).end('Not Found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': String(stat.size),
    'Cache-Control': 'no-cache',
  });
  createReadStream(filePath).pipe(res);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用，请换一个：node server.mjs 8081`);
  } else {
    console.error(error.message);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}/`;
  console.log('');
  console.log('  Virtual Guitar 已启动');
  console.log(`  ${url}`);
  console.log('');
  console.log('  按 Ctrl+C 停止');
  console.log('');

  // NO_OPEN=1 时不自动打开浏览器（测试/无桌面环境用）
  if (process.env.NO_OPEN) return;

  const open =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(open, () => {
    /* 打不开就手动访问上面的地址 */
  });
});
