import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    build({
      // アイコン・マニフェストをWorkerではなく静的ファイルとして配信
      staticPaths: ['/static/*', '/timer-1024.png', '/manifest.json'],
    }),
    devServer({
      adapter,
      entry: 'src/index.tsx'
    })
  ]
})
