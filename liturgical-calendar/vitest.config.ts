import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@engine': resolve(__dirname, 'src/engine'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
