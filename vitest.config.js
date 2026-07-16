import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));
const alias = { '@': path.resolve(srcDir) };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'backend',
          globals: true,
          environment: 'node',
          include: ['tests/**/*.test.js'],
          // Frontend specs are covered by the `frontend` project below.
          exclude: ['tests/frontend/**', '**/node_modules/**', '**/dist/**'],
          setupFiles: ['./tests/setup.js'],
        },
      },
      {
        resolve: { alias },
        plugins: [react()],
        test: {
          name: 'frontend',
          globals: true,
          environment: 'jsdom',
          include: ['tests/frontend/**/*.test.{js,jsx}'],
          setupFiles: ['./tests/setup.js', './tests/frontend/setup.js'],
        },
      },
    ],
  },
});
