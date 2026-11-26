/**
 * Tests for PythonAnalyzer
 *
 * Tests the requirements.txt parser and dependency health calculation
 * in isolation — no network calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { PythonAnalyzer } from '../../../src/services/language-analyzers/python-analyzer';

vi.mock('axios');

const mockedAxios = vi.mocked(axios);

describe('PythonAnalyzer', () => {
  let analyzer: PythonAnalyzer;

  beforeEach(() => {
    analyzer = new PythonAnalyzer();
    vi.clearAllMocks();
  });

  // ─── requirements.txt parsing ─────────────────────────────────────────────

  describe('requirements.txt parsing', () => {
    it('handles empty requirements.txt', async () => {
      const result = await analyzer.analyzePythonDependencies('', 'requirements.txt');
      expect(result.totalDependencies).toBe(0);
      expect(result.dependencyHealth).toBe('excellent');
    });

    it('skips comment lines', async () => {
      // All comment lines — PyPI will not be called
      const content = '# This is a comment\n# another comment\n';
      const result = await analyzer.analyzePythonDependencies(content, 'requirements.txt');
      expect(result.totalDependencies).toBe(0);
    });

    it('skips -r include directives', async () => {
      const content = '-r other-requirements.txt\n';
      const result = await analyzer.analyzePythonDependencies(content, 'requirements.txt');
      expect(result.totalDependencies).toBe(0);
    });

    it('skips VCS / URL dependencies', async () => {
      const content = 'git+https://github.com/user/repo.git\n';
      const result = await analyzer.analyzePythonDependencies(content, 'requirements.txt');
      expect(result.totalDependencies).toBe(0);
    });

    it('handles PyPI registry unavailable gracefully', async () => {
      mockedAxios.get = vi.fn().mockRejectedValue(new Error('Network unavailable'));
      const content = 'requests==2.28.0\n';
      // Should not throw — PyPI failure is a best-effort check
      const result = await analyzer.analyzePythonDependencies(content, 'requirements.txt');
      expect(result).toBeDefined();
    });
  });

  // ─── Unsupported file type ────────────────────────────────────────────────

  describe('unsupported file type', () => {
    it('throws for unknown dependency file format', async () => {
      await expect(
        analyzer.analyzePythonDependencies('content', 'unknown.txt' as any)
      ).rejects.toThrow('Unsupported Python dependency file type');
    });
  });

  // ─── Health score calculation ─────────────────────────────────────────────

  describe('dependency health', () => {
    it('returns excellent health for empty dependency list', async () => {
      const result = await analyzer.analyzePythonDependencies('', 'requirements.txt');
      expect(result.dependencyHealth).toBe('excellent');
      expect(result.healthScore).toBe(100);
    });

    it('health score is between 0 and 100', async () => {
      mockedAxios.get = vi.fn().mockResolvedValue({
        data: {
          info: { name: 'requests', version: '2.28.0', summary: 'HTTP library' },
          releases: { '2.28.0': [], '2.31.0': [] },
          vulnerabilities: [],
        },
      });
      const content = 'requests==2.28.0\n';
      const result = await analyzer.analyzePythonDependencies(content, 'requirements.txt');
      expect(result.healthScore).toBeGreaterThanOrEqual(0);
      expect(result.healthScore).toBeLessThanOrEqual(100);
    });
  });
});
