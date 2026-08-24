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
      '/api/translations': 'http://localhost:8090',
      '/api/events': 'http://localhost:8091',
      '/api/admin': 'http://localhost:8091',
      '/calendars': 'http://localhost:8091',
    },
  },
  resolve: {
    alias: {
      '@engine': resolve(__dirname, 'src/engine'),
    },
  },
});
