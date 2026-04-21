import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'api',
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 75,
      },
      include: ['src/**/*.ts'],
      exclude: ['src/db/migrations/**', 'src/db/seed.ts', 'src/test/**'],
    },
  },
})
