import { createReadStream, statSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Connect, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const PUBLIC_DIR = resolve(fileURLToPath(new URL('./public', import.meta.url)))

const MIME_TYPES: Record<string, string> = {
  '.wav': 'audio/wav',
  '.sfz': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

/**
 * 直接从磁盘提供 /sounds/ 下的音源文件。
 *
 * 音源目录名与文件名同时包含空格、`+` 和 `#`（升号音名，如 C#4_s5_01.wav）。
 * Vite 内置的静态文件中间件把路径里的 `#` 当作 URL fragment 丢掉，
 * 于是 `/C%234_s5_01.wav` 一律回退到 index.html —— 表现是所有升号采样静音。
 *
 * 这里在 Vite 的静态中间件之前接管 /sounds/：完整解码后直接读文件，
 * 顺便给出正确的 Content-Type。生产环境部署到常规静态服务器时，
 * `%23` 会被正常解码，不受此问题影响。
 */
function serveSamplesFromDisk(): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url || !req.url.startsWith('/sounds/')) return next()

    const [rawPath] = req.url.split('?')
    let decoded: string
    try {
      decoded = decodeURIComponent(rawPath)
    } catch {
      return next()
    }

    const filePath = normalize(join(PUBLIC_DIR, decoded))
    // 防目录穿越
    if (!filePath.startsWith(PUBLIC_DIR + sep)) return next()

    let size: number
    try {
      const stat = statSync(filePath)
      if (!stat.isFile()) return next()
      size = stat.size
    } catch {
      return next()
    }

    res.setHeader(
      'Content-Type',
      MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    )
    res.setHeader('Content-Length', String(size))
    res.setHeader('Cache-Control', 'no-cache')
    createReadStream(filePath).pipe(res)
  }

  return {
    name: 'virtual-guitar:serve-samples-from-disk',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serveSamplesFromDisk()],
  test: {
    // 音频引擎的核心逻辑是纯函数/纯数据结构，不需要浏览器环境
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
