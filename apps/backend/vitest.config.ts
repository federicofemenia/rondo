import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    // Integration tests share one real Postgres instance (no per-worker sandbox),
    // so test files must not run concurrently or they race on the same rows.
    fileParallelism: false,
  },
});
