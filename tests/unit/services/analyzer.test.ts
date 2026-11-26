/**
 * Tests for RepositoryAnalyzer
 *
 * We test the scoring logic in isolation by mocking GitHubService
 * so no real network calls are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepositoryAnalyzer } from '../../../src/services/analyzer';
import {
  makeRepository,
  abandonedRepo,
  activeRepo,
  ghostRepo,
  openIssue,
  closedIssue,
} from '../../fixtures/github.fixtures';

// Mock DependencyAnalyzer to prevent real npm registry calls
vi.mock('../../../src/services/dependency-analyzer', () => ({
  DependencyAnalyzer: vi.fn().mockImplementation(() => ({
    analyzeDependencies: vi.fn().mockResolvedValue({
      totalDependencies: 0,
      outdatedDependencies: 0,
      vulnerableDependencies: 0,
      criticalVulnerabilities: 0,
      dependencyHealth: 'unknown',
      healthScore: 100,
      dependencies: [],
      recommendations: [],
      lastUpdated: new Date(),
    }),
  })),
}));

// Mock MLPredictor to prevent fs reads during analyzer construction
vi.mock('../../../src/services/ml-predictor', () => ({
  MLPredictor: vi.fn().mockImplementation(() => ({
    isMLAvailable: vi.fn().mockReturnValue(false),
    enhanceAnalysis: vi.fn(),
  })),
}));

// Minimal mock for GitHubService
function makeGitHubServiceMock(overrides: Partial<Record<string, any>> = {}) {
  return {
    getRepositoryIssues: vi.fn().mockResolvedValue([]),
    getRepositoryCommits: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('RepositoryAnalyzer', () => {
  let githubMock: ReturnType<typeof makeGitHubServiceMock>;
  let analyzer: RepositoryAnalyzer;

  beforeEach(() => {
    githubMock = makeGitHubServiceMock();
    analyzer = new RepositoryAnalyzer(githubMock as any);
  });

  // ─── analyzeRepository returns required fields ────────────────────────────

  describe('analyzeRepository — return shape', () => {
    it('returns all required fields', async () => {
      const result = await analyzer.analyzeRepository(makeRepository());

      expect(result).toHaveProperty('repository');
      expect(result).toHaveProperty('abandonmentScore');
      expect(result).toHaveProperty('revivalPotential');
      expect(result).toHaveProperty('lastCommitAge');
      expect(result).toHaveProperty('issueResponseTime');
      expect(result).toHaveProperty('dependencyHealth');
      expect(result).toHaveProperty('communityEngagement');
      expect(result).toHaveProperty('technicalComplexity');
      expect(result).toHaveProperty('marketRelevance');
      expect(result).toHaveProperty('reasons');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('scoringMethod');
    });

    it('scores are within valid ranges', async () => {
      const result = await analyzer.analyzeRepository(makeRepository());

      expect(result.abandonmentScore).toBeGreaterThanOrEqual(0);
      expect(result.abandonmentScore).toBeLessThanOrEqual(100);
      expect(result.revivalPotential).toBeGreaterThanOrEqual(0);
      expect(result.revivalPotential).toBeLessThanOrEqual(100);
      expect(result.communityEngagement).toBeGreaterThanOrEqual(0);
      expect(result.communityEngagement).toBeLessThanOrEqual(100);
      expect(result.marketRelevance).toBeGreaterThanOrEqual(0);
      expect(result.marketRelevance).toBeLessThanOrEqual(100);
    });

    it('reasons and recommendations are arrays', async () => {
      const result = await analyzer.analyzeRepository(makeRepository());

      expect(Array.isArray(result.reasons)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  // ─── Abandonment scoring ──────────────────────────────────────────────────

  describe('abandonment scoring', () => {
    it('scores archived repo higher than active', async () => {
      const archivedResult = await analyzer.analyzeRepository(abandonedRepo);
      const activeResult = await analyzer.analyzeRepository(activeRepo);

      expect(archivedResult.abandonmentScore).toBeGreaterThan(activeResult.abandonmentScore);
    });

    it('scores high for a clearly abandoned repo', async () => {
      // abandoned since 2021-01-01, archived
      const result = await analyzer.analyzeRepository(abandonedRepo);
      expect(result.abandonmentScore).toBeGreaterThan(40);
    });

    it('includes abandonment reason when last commit is old', async () => {
      const result = await analyzer.analyzeRepository(abandonedRepo);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('scores archived as contributing to abandonment', async () => {
      const archived = makeRepository({ archived: true, pushed_at: '2020-01-01T00:00:00Z' });
      const notArchived = makeRepository({ archived: false, pushed_at: '2020-01-01T00:00:00Z' });
      githubMock.getRepositoryIssues.mockResolvedValue([]);
      githubMock.getRepositoryCommits.mockResolvedValue([]);

      const archivedResult = await analyzer.analyzeRepository(archived);
      const notArchivedResult = await analyzer.analyzeRepository(notArchived);

      expect(archivedResult.abandonmentScore).toBeGreaterThan(notArchivedResult.abandonmentScore);
    });

    it('open issues with no responses push abandonment score up', async () => {
      // 15 old open issues, no commits
      const manyOldIssues = Array.from({ length: 15 }, (_, i) => ({
        ...openIssue,
        id: 200 + i,
        created_at: '2022-01-01T00:00:00Z', // old enough
      }));
      githubMock.getRepositoryIssues.mockResolvedValue(manyOldIssues);
      githubMock.getRepositoryCommits.mockResolvedValue([]);

      const withIssues = await analyzer.analyzeRepository(
        makeRepository({ pushed_at: '2022-01-01T00:00:00Z' })
      );
      githubMock.getRepositoryIssues.mockResolvedValue([]);
      const noIssues = await analyzer.analyzeRepository(
        makeRepository({ pushed_at: '2022-01-01T00:00:00Z' })
      );

      expect(withIssues.abandonmentScore).toBeGreaterThan(noIssues.abandonmentScore);
    });
  });

  // ─── Revival potential ────────────────────────────────────────────────────

  describe('revival potential', () => {
    it('high-star repo has better revival potential than zero-star', async () => {
      const popular = makeRepository({ stargazers_count: 2000, forks_count: 400 });
      const obscure = makeRepository({ stargazers_count: 1, forks_count: 0 });

      const popularResult = await analyzer.analyzeRepository(popular);
      const obscureResult = await analyzer.analyzeRepository(obscure);

      expect(popularResult.revivalPotential).toBeGreaterThan(obscureResult.revivalPotential);
    });

    it('repo with license has better revival than unlicensed', async () => {
      const licensed = makeRepository({ license: { key: 'mit', name: 'MIT License' } });
      const unlicensed = makeRepository({ license: null });

      const licensedResult = await analyzer.analyzeRepository(licensed);
      const unlicensedResult = await analyzer.analyzeRepository(unlicensed);

      expect(licensedResult.revivalPotential).toBeGreaterThanOrEqual(unlicensedResult.revivalPotential);
    });

    it('scores are non-negative even for ghost repo', async () => {
      const result = await analyzer.analyzeRepository(ghostRepo);

      expect(result.revivalPotential).toBeGreaterThanOrEqual(0);
      expect(result.abandonmentScore).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── Technical complexity ─────────────────────────────────────────────────

  describe('technical complexity', () => {
    it('small repo is classified as low complexity', async () => {
      const small = makeRepository({ size: 50 });
      const result = await analyzer.analyzeRepository(small);
      expect(result.technicalComplexity).toBe('low');
    });

    it('medium repo is classified as medium complexity', async () => {
      const medium = makeRepository({ size: 5000 });
      const result = await analyzer.analyzeRepository(medium);
      expect(result.technicalComplexity).toBe('medium');
    });

    it('large repo is classified as high complexity', async () => {
      const large = makeRepository({ size: 50000 });
      const result = await analyzer.analyzeRepository(large);
      expect(result.technicalComplexity).toBe('high');
    });
  });

  // ─── Issue response time ──────────────────────────────────────────────────

  describe('issueResponseTime', () => {
    it('returns -1 when no closed issues exist', async () => {
      githubMock.getRepositoryIssues.mockResolvedValue([openIssue]);
      const result = await analyzer.analyzeRepository(makeRepository());
      expect(result.issueResponseTime).toBe(-1);
    });

    it('calculates response time from closed issues', async () => {
      githubMock.getRepositoryIssues.mockResolvedValue([closedIssue]);
      const result = await analyzer.analyzeRepository(makeRepository());
      expect(result.issueResponseTime).toBeGreaterThan(0);
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles API failure on issues gracefully', async () => {
      githubMock.getRepositoryIssues.mockRejectedValue(new Error('Network error'));
      // Should not throw — uses allSettled internally
      await expect(analyzer.analyzeRepository(makeRepository())).resolves.toBeDefined();
    });

    it('handles API failure on commits gracefully', async () => {
      githubMock.getRepositoryCommits.mockRejectedValue(new Error('Network error'));
      await expect(analyzer.analyzeRepository(makeRepository())).resolves.toBeDefined();
    });

    it('handles repo with null description and no topics', async () => {
      const sparse = makeRepository({ description: null, topics: [] });
      const result = await analyzer.analyzeRepository(sparse);
      expect(result).toBeDefined();
    });
  });
});
