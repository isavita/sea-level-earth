import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Advertises the lazily-imported globe chunk in the HTML.
 *
 * The globe is code-split so the shell can paint without waiting on Three.js,
 * but that also hides the largest file on the page from the preload scanner:
 * nothing asks for it until the entry chunk has downloaded, parsed and rendered
 * once — measured at 749 ms before its own ~520 KB even started. A
 * `modulepreload` costs nothing (the chunk is always needed) and moves that
 * download in parallel with the entry chunk. The filename is hashed, so it has
 * to be read out of the bundle rather than hard-coded.
 */
function preloadGlobeChunk(): Plugin {
  let base = '/'
  return {
    name: 'preload-globe-chunk',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const chunk = Object.values(ctx.bundle ?? {}).find(
          (c) => c.type === 'chunk' && c.isDynamicEntry && c.name === 'EarthGlobe',
        )
        if (!chunk) return html
        return {
          html,
          tags: [
            {
              tag: 'link',
              attrs: {
                rel: 'modulepreload',
                href: `${base}${chunk.fileName}`,
                crossorigin: true,
              },
              injectTo: 'head',
            },
          ],
        }
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), preloadGlobeChunk()],
  build: {
    target: 'es2020',
    // Three.js is legitimately large and is already split into its own async
    // chunk via the lazy-loaded globe; don't warn on it.
    chunkSizeWarningLimit: 2000,
  },
})
