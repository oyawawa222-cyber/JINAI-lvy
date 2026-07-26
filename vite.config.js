import { defineConfig } from 'vite'
export default defineConfig({
  base: './',
  publicDir: 'public',
  server: {
    port: 3000,
    open: true,
    host: true,
    // 新增CSP响应头，放行unsafe-eval
    headers: {
      "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws: wss:; object-src 'self';"
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'static',
    emptyOutDir: true
  }
})
