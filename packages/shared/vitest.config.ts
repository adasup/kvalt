import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'shared',
    environment: 'node',
    coverage: {
      provider: 'v8',
      thresholds: { lines: 95, functions: 95, branches: 95 },
    },
  },
})
