/**
 * REPOSOUL — Vitest global test setup
 *
 * Runs before every test file. Use for global mocks, environment
 * overrides, and cleanup that should apply to all tests.
 */

import { vi } from 'vitest';

// Suppress console output during tests unless explicitly expected.
// Individual tests can call vi.spyOn(console, 'log') to assert on output.
beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

// Ensure no real GITHUB_TOKEN leaks into tests
beforeEach(() => {
  delete process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_OAUTH_TOKEN;
  delete process.env.GITHUB_TOKEN_TYPE;
});
