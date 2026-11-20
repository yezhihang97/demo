import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  publicDir: 'assets',
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    proxy: { '/api': { target: 'http://127.0.0.1:' + (process.env.BACKEND_PORT || 8787), changeOrigin: false } }
  }
});
