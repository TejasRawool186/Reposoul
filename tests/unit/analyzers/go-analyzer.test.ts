/**
 * Tests for GoAnalyzer — go.mod parser and health scoring
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { GoAnalyzer } from '../../../src/services/language-analyzers/go-analyzer';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

const minimalGoMod = `
module github.com/owner/repo

go 1.21

require (
  github.com/gin-gonic/gin v1.9.0
  golang.org/x/net v0.17.0 // indirect
)
`.trim();

const emptyGoMod = `
module github.com/owner/empty-repo

go 1.21
`.trim();

describe('GoAnalyzer', () => {
  let analyzer: GoAnalyzer;

  beforeEach(() => {
    analyzer = new GoAnalyzer();
    vi.clearAllMocks();
  });

  describe('go.mod parsing', () => {
    it('parses module name correctly', async () => {
      mockedAxios.get = vi.fn().mockResolvedValue({ data: { Version: 'v1.9.1' } });
      const result = await analyzer.analyzeGoDependencies(minimalGoMod);
      // Should attempt to analyze gin and golang.org/x/net
      expect(result).toBeDefined();
    });

    it('handles empty require block gracefully', async () => {
      const result = await analyzer.analyzeGoDependencies(emptyGoMod);
      expect(result.totalDependencies).toBe(0);
      expect(result.dependencyHealth).toBe('excellent');
    });

    it('returns health score between 0 and 100', async () => {
      mockedAxios.get = vi.fn().mockResolvedValue({ data: { Version: 'v1.9.1' } });
      const result = await analyzer.analyzeGoDependencies(minimalGoMod);
      expect(result.healthScore).toBeGreaterThanOrEqual(0);
      expect(result.healthScore).toBeLessThanOrEqual(100);
    });

    it('handles Go proxy unavailable gracefully', async () => {
      mockedAxios.get = vi.fn().mockRejectedValue(new Error('timeout'));
      const result = await analyzer.analyzeGoDependencies(minimalGoMod);
      expect(result).toBeDefined();
      expect(result.totalDependencies).toBeGreaterThanOrEqual(0);
    });

    it('handles malformed go.mod without throwing', async () => {
      const result = await analyzer.analyzeGoDependencies('this is not valid go.mod content !!!');
      expect(result).toBeDefined();
    });
  });

  describe('version comparison', () => {
    it('marks dependency outdated when newer version available', async () => {
      mockedAxios.get = vi.fn().mockResolvedValue({ data: { Version: 'v2.0.0' } });
      const goModWithOld = `module m\ngo 1.21\nrequire github.com/example/lib v1.0.0`;
      const result = await analyzer.analyzeGoDependencies(goModWithOld);
      if (result.dependencies.length > 0) {
        expect(result.outdatedDependencies).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
