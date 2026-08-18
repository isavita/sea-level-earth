// Minimal zero-dependency static server for the built SPA.
// Serves ./dist, negotiates gzip, sets sensible cache headers, and binds to
// the port Railway provides via $PORT. No framework, nothing to keep patched.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import {
  gzipSync,
  brotliCompress,
  brotliCompressSync,
  constants as zlibConstants,
} from 'node:zlib'
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

/**
 * Brotli quality is a sharp trade-off on the big Three.js chunk: q9 takes 69 ms
 * and beats gzip by 14%, q11 takes 3.6 s and beats it by 22%. So each file gets
 * q9 up front — cheap enough to sit in the request path — and is then upgraded
 * to q11 in the background, off the event loop. Requests that land before the
 * upgrade finishes are still served brotli, just the slightly larger one.
 */
function upgradeToMaxBrotli(entry, raw) {
  brotliCompress(
    raw,
    {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
        [zlibConstants.BROTLI_PARAM_SIZE_HINT]: raw.length,
      },
    },
    (err, out) => {
      if (!err && out && out.length < entry.brotli.length) entry.brotli = out
    },
  )
}

async function load(path) {
  if (cache.has(path)) return cache.get(path)
  const raw = await readFile(path)
  const ext = extname(path)
  const compressible = COMPRESSIBLE.has(ext)
  const entry = {
    raw,
    gzip: compressible ? gzipSync(raw, { level: 8 }) : null,
    brotli: compressible
      ? brotliCompressSync(raw, {
          params: {
            [zlibConstants.BROTLI_PARAM_QUALITY]: 9,
            [zlibConstants.BROTLI_PARAM_SIZE_HINT]: raw.length,
          },
        })
      : null,
    type: MIME[ext] ?? 'application/octet-stream',
  }
  cache.set(path, entry)
  if (entry.brotli) upgradeToMaxBrotli(entry, raw)
  return entry
}

/** Pick the best encoding the client actually asked for. */
function negotiate(entry, acceptEncoding) {
  const accept = acceptEncoding || ''
  if (entry.brotli && /\bbr\b/.test(accept)) {
    return { body: entry.brotli, encoding: 'br' }
  }
  if (entry.gzip && /\bgzip\b/.test(accept)) {
    return { body: entry.gzip, encoding: 'gzip' }
  }
  return { body: entry.raw, encoding: null }
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

    const { body, encoding } = negotiate(entry, req.headers['accept-encoding'])
    const headers = {
      'content-type': entry.type,
      'content-length': body.length,
      'cache-control': cacheControl(urlPath),
      vary: 'Accept-Encoding',
    }
    if (encoding) headers['content-encoding'] = encoding

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
