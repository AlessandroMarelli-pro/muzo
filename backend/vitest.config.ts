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
    // Integration tests each CREATE/DROP a real Postgres database in
    // beforeAll/afterAll (see tests/.../_test-utils/integration-db.ts).
    // DROP DATABASE takes an internal barrier lock that every other backend
    // must acknowledge -- running these files in parallel worker processes
    // (Vitest's default) causes them to contend on that barrier and can hang
    // well past any reasonable timeout. Forcing this to a single fork makes
    // integration test files run one at a time, avoiding the contention
    // entirely; unit tests (the vast majority of the suite) are unaffected
    // since they don't touch a real database.
    hookTimeout: 30000,
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
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
