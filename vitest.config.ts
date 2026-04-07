import { defineConfig } from 'vitest/config';

// Mirrors TIMEOUT_IN_MILLISECONDS in test/helpers/module-setup.ts: a number
// of `beforeAll` hooks call resetTestModule() which can take a couple of
// minutes to yarn-install the test fixture (longer on Windows). Vitest's
// describe-level `timeout` only applies to tests, not hooks, so the hook
// budget has to come from here.
const TIMEOUT_IN_MINUTES = process.platform === 'win32' ? 5 : 2;
const TIMEOUT_IN_MILLISECONDS = TIMEOUT_IN_MINUTES * 60 * 1000;

export default defineConfig({
  test: {
    include: ['test/*.ts'],
    reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : 'default',
    testTimeout: 30_000,
    hookTimeout: TIMEOUT_IN_MILLISECONDS,
    // Test files share a single TEST_MODULE_PATH on disk, so they cannot run
    // in parallel without clobbering each other's fixtures.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['lib/**/*.js'],
    },
  },
});
