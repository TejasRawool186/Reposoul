/**
 * Tests for DependencyAnalyzer — npm / multi-language dispatch
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { DependencyAnalyzer } from '../../../src/services/dependency-analyzer';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

function makeGitHubServiceMock() {
  return {
    api: { get: vi.fn() },
  };
}

/** Minimal valid package.json with one dependency */
const minimalPackageJson = JSON.stringify({
  name: 'test-pkg',
  dependencies: { axios: '^1.0.0' },
  devDependencies: {},
});

/** package.json with no dependencies at all */
const emptyDepsPackageJson = JSON.stringify({
  name: 'empty',
});

describe('DependencyAnalyzer', () => {
  let githubMock: ReturnType<typeof makeGitHubServiceMock>;
  let analyzer: DependencyAnalyzer;

  beforeEach(() => {
    githubMock = makeGitHubServiceMock();
    analyzer = new DependencyAnalyzer(githubMock as any);
    vi.clearAllMocks();
  });

  // ─── getSupportedLanguages ────────────────────────────────────────────────

  describe('getSupportedLanguages', () => {
    it('returns an array of supported language strings', () => {
      const langs = analyzer.getSupportedLanguages();
      expect(Array.isArray(langs)).toBe(true);
      expect(langs.length).toBeGreaterThan(0);
    });

    it('includes javascript and typescript', () => {
      const langs = analyzer.getSupportedLanguages();
      expect(langs).toContain('javascript');
      expect(langs).toContain('typescript');
    });

    it('includes python, rust, go, java', () => {
      const langs = analyzer.getSupportedLanguages();
      ['python', 'rust', 'go', 'java'].forEach(lang => {
        expect(langs).toContain(lang);
      });
    });
  });

  // ─── isLanguageSupported ──────────────────────────────────────────────────

  describe('isLanguageSupported', () => {
    it('returns true for supported languages', () => {
      expect(analyzer.isLanguageSupported('python')).toBe(true);
      expect(analyzer.isLanguageSupported('rust')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(analyzer.isLanguageSupported('Python')).toBe(true);
      expect(analyzer.isLanguageSupported('RUST')).toBe(true);
    });

    it('returns false for unsupported languages', () => {
      expect(analyzer.isLanguageSupported('cobol')).toBe(false);
      expect(analyzer.isLanguageSupported('brainfuck')).toBe(false);
    });
  });

  // ─── analyzeDependencies — no dependency files ────────────────────────────

  describe('analyzeDependencies — no files found', () => {
    it('returns unknown health when no package files exist', async () => {
      // Mock both the multi-language path and the fallback GitHub contents call
      mockedAxios.get = vi.fn().mockRejectedValue({ response: { status: 404 } });

      const result = await analyzer.analyzeDependencies('owner', 'repo');
      expect(result.dependencyHealth).toBe('unknown');
      expect(result.totalDependencies).toBe(0);
    });
  });

  // ─── analyzePackageJson-like (via analyzeDependencies with npm mock) ───────

  describe('analyzeDependencies — with package.json', () => {
    it('returns a valid DependencyAnalysis shape', async () => {
      // First call: multi-language analyzer tries GitHub contents API
      // We stub it to simulate finding package.json
      mockedAxios.get = vi.fn()
        // Multi-language: language detection
        .mockResolvedValueOnce({ data: { TypeScript: 10000 } })
        // Multi-language: dependency file checks (many calls) — resolve first as found
        .mockResolvedValueOnce({ data: { content: Buffer.from(minimalPackageJson).toString('base64') } })
        // Remaining file check calls — not found
        .mockRejectedValue({ response: { status: 404 } });

      const result = await analyzer.analyzeDependencies('owner', 'repo');

      expect(result).toHaveProperty('totalDependencies');
      expect(result).toHaveProperty('dependencyHealth');
      expect(result).toHaveProperty('healthScore');
      expect(result).toHaveProperty('recommendations');
      expect(result.healthScore).toBeGreaterThanOrEqual(0);
      expect(result.healthScore).toBeLessThanOrEqual(100);
    });

    it('returns all-healthy for empty dependencies', async () => {
      mockedAxios.get = vi.fn()
        .mockResolvedValueOnce({ data: { JavaScript: 5000 } })
        .mockResolvedValueOnce({ data: { content: Buffer.from(emptyDepsPackageJson).toString('base64') } })
        .mockRejectedValue({ response: { status: 404 } });

      const result = await analyzer.analyzeDependencies('owner', 'repo');

      expect(result.outdatedDependencies).toBe(0);
      expect(result.criticalVulnerabilities).toBe(0);
    });
  });
});
