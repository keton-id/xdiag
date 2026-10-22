import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts', 'src/theme.ts', 'src/types/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/engine/sampleSchema.ts'],
    },
  },
});
