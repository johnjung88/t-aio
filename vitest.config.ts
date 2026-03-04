import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

const alias = { '@': path.resolve(__dirname, '.') }

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    globals: true,
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          include: ['__tests__/**/*.test.ts'],
          exclude: ['__tests__/e2e/**'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'e2e',
          environment: 'node',
          globals: true,
          include: ['__tests__/e2e/**/*.e2e.test.ts'],
          testTimeout: 60_000,
          hookTimeout: 30_000,
          pool: 'forks',
          poolOptions: {
            forks: { singleFork: true },
          },
        },
      },
    ],
  },
})
