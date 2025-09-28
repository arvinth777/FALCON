import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './test/setup.js',
    css: true,
    timeout: 10000,
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'test/**',
        '**/*.test.{js,jsx}',
        '**/*.config.{js,ts}',
        'coverage/**',
        'dist/**',
        'src/main.jsx'
      ],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 85,
        lines: 85
      },
      all: true,
      skipFull: false
    }
  }
});
