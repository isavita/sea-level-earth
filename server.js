// Minimal zero-dependency static server for the built SPA.
// Serves ./dist, negotiates gzip, sets sensible cache headers, and binds to
// the port Railway provides via $PORT. No framework, nothing to keep patched.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { join, normalize, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'dist')
const PORT = Number(process.env.PORT) || 3000
const HOST = '0.0.0.0'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt'])

// Cache the raw + gzipped bytes of each served file for the process lifetime.
const cache = new Map()

async function load(path) {
  if (cache.has(path)) return cache.get(path)
  const raw = await readFile(path)
  const ext = extname(path)
  const entry = {
    raw,
    gzip: COMPRESSIBLE.has(ext) ? gzipSync(raw, { level: 8 }) : null,
    type: MIME[ext] ?? 'application/octet-stream',
  }
  cache.set(path, entry)
  return entry
}

function cacheControl(urlPath) {
  // Vite fingerprints everything under /assets — cache it forever.
  if (urlPath.startsWith('/assets/')) return 'public, max-age=31536000, immutable'
  if (urlPath === '/' || urlPath.endsWith('.html')) return 'no-cache'
  return 'public, max-age=3600'
}

function safePath(urlPath) {
  // Strip query/hash, normalise, and refuse anything that escapes ROOT.
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(
    /^(\.\.[/\\])+/,
    '',
  )
  const resolved = join(ROOT, clean)
  return resolved.startsWith(ROOT) ? resolved : null
}

const server = createServer(async (req, res) => {
  try {
    const urlPath = (req.url || '/').split('?')[0]
    let filePath = safePath(urlPath === '/' ? '/index.html' : urlPath)

    let entry = null
    if (filePath) {
      try {
        entry = await load(filePath)
      } catch {
        entry = null
      }
    }

    // SPA fallback: unknown, extension-less routes get index.html.
    if (!entry && !extname(urlPath)) {
      filePath = join(ROOT, 'index.html')
      try {
        entry = await load(filePath)
      } catch {
        entry = null
      }
    }

    if (!entry) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }

    const wantsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '')
    const body = wantsGzip && entry.gzip ? entry.gzip : entry.raw
    const headers = {
      'content-type': entry.type,
      'content-length': body.length,
      'cache-control': cacheControl(urlPath),
      vary: 'Accept-Encoding',
    }
    if (wantsGzip && entry.gzip) headers['content-encoding'] = 'gzip'

    res.writeHead(200, headers)
    res.end(req.method === 'HEAD' ? undefined : body)
  } catch (err) {
    console.error('request error', err)
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Server error')
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Meridian serving ./dist on http://${HOST}:${PORT}`)
})
