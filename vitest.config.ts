import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.ts'],
    exclude: ['test/helpers/**/*.ts'],
    fileParallelism: false,
  },
});
