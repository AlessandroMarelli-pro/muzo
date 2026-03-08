import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
console.log('__dirname', __dirname);
export default defineConfig({
  resolve: {
    alias: {
      // Generated client imports @prisma/client/runtime/*; resolve entire runtime dir from node_modules
      '@prisma/client/runtime': path.resolve(__dirname, 'node_modules/@prisma/client/runtime'),
      '@prisma/client': path.resolve(__dirname, 'src/generated/prisma/client'),
      src: path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.spec.ts', 'src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['node_modules', 'dist', '**/*.spec.ts', '**/*.d.ts'],
    },
  },
});
