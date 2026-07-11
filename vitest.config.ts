import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.e2e.test.ts', 'server/**/*.test.ts'],
    exclude: ['**/population.benchmark.test.ts'],
  },
})
