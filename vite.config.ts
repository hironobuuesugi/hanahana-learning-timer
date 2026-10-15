import build from '@hono/vite-build/cloudflare-pages'
import { defineConfig } from 'vite'

// ZIPのPages設定をビルド専用に限定。devserver/adapterは読み込まない。
export default defineConfig({
  envDir: false,
  envFile: false,
  cacheDir: 'cache/pages-build/vite',
  plugins: [
    build({
      entry: 'src/index.tsx',
      outputDir: './build/pages-subjects-20261016/dist',
      emptyOutDir: false,
      staticPaths: ['/static/*', '/timer-1024.png', '/manifest.json'],
    }),
  ],
})
