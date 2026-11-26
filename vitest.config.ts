import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Discover all test files in tests/ directory
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],

    // Global test setup file
    setupFiles: ['tests/setup.ts'],

    // Environment — node is correct for a CLI tool
    environment: 'node',

    // Globals: allow describe/it/expect without imports (like Jest)
    globals: true,

    // Use forks pool for better isolation; limit concurrency to avoid port contention
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 4,
      },
    },

    // Per-test and per-suite timeouts
    testTimeout: 10000,
    hookTimeout: 10000,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/cli.ts',        // CLI entry — tested via integration, not unit
        'src/index.ts',      // Re-exports only
        'dist/**',
        'node_modules/**',
      ],
      thresholds: {
        lines: 30,           // Honest Phase 2 baseline — ml-trainer/org-scanner excluded from unit coverage
        functions: 40,       // Functions covered well by existing tests
        branches: 30,
        statements: 30,
      },
    },
  },
});
