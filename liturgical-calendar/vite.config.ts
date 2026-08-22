import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src/ui',
  base: '/divinum-officium/',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8090',
    },
  },
  resolve: {
    alias: {
      '@engine': resolve(__dirname, 'src/engine'),
    },
  },
});
