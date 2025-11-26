import { afterAll, beforeAll } from 'vitest';

// Global test setup
beforeAll(async () => {
  // Setup any global test configuration
  console.log('Setting up contract tests...');
});

afterAll(async () => {
  // Cleanup after all tests
  console.log('Cleaning up contract tests...');
});
