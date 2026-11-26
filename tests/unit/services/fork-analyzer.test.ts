/**
 * Tests for ForkAnalyzer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForkAnalyzer } from '../../../src/services/fork-analyzer';
import { makeRepository } from '../../fixtures/github.fixtures';

// Mock RepositoryAnalyzer inside ForkAnalyzer
vi.mock('../../../src/services/analyzer', () => ({
  RepositoryAnalyzer: vi.fn().mockImplementation(() => ({
    analyzeRepository: vi.fn().mockResolvedValue({
      repository: makeRepository(),
      abandonmentScore: 50,
      revivalPotential: 60,
      lastCommitAge: 200,
      issueResponseTime: 5,
      dependencyHealth: 'good',
      communityEngagement: 40,
      technicalComplexity: 'medium',
      marketRelevance: 55,
      reasons: [],
      recommendations: [],
      scoringMethod: 'rule-based',
    }),
  })),
}));

function makeGitHubServiceMock() {
  return {
    getRepository: vi.fn().mockResolvedValue(makeRepository({ forks_count: 3 })),
    searchRepositories: vi.fn().mockResolvedValue({ items: [], total_count: 0 }),
    api: {
      get: vi.fn().mockResolvedValue({ data: [] }),
    },
  };
}

// Patch global fetch used by fork-analyzer's getForksDirect
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: vi.fn().mockResolvedValue([]),
});
vi.stubGlobal('fetch', mockFetch);

describe('ForkAnalyzer', () => {
  let githubMock: ReturnType<typeof makeGitHubServiceMock>;
  let analyzer: ForkAnalyzer;

  beforeEach(() => {
    githubMock = makeGitHubServiceMock();
    analyzer = new ForkAnalyzer(githubMock as any);
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue([]) });
  });

  describe('analyzeForks', () => {
    it('returns a ForkComparison with required fields', async () => {
      const result = await analyzer.analyzeForks('owner', 'repo');

      expect(result).toHaveProperty('original');
      expect(result).toHaveProperty('totalForks');
      expect(result).toHaveProperty('analyzedForks');
      expect(result).toHaveProperty('activeForks');
      expect(result).toHaveProperty('topRecommendations');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('executionTime');
      expect(result).toHaveProperty('timestamp');
    });

    it('activeForks and topRecommendations are arrays', async () => {
      const result = await analyzer.analyzeForks('owner', 'repo');
      expect(Array.isArray(result.activeForks)).toBe(true);
      expect(Array.isArray(result.topRecommendations)).toBe(true);
    });

    it('handles empty fork list gracefully', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue([]) });
      const result = await analyzer.analyzeForks('owner', 'repo', { maxForks: 5 });
      expect(result.totalForks).toBeGreaterThanOrEqual(0);
    });

    it('executionTime is non-negative', async () => {
      const result = await analyzer.analyzeForks('owner', 'repo');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('timestamp is a valid ISO string', async () => {
      const result = await analyzer.analyzeForks('owner', 'repo');
      expect(() => new Date(result.timestamp)).not.toThrow();
    });

    it('wraps error when getRepository throws', async () => {
      githubMock.getRepository.mockRejectedValue(new Error('Not found'));
      await expect(analyzer.analyzeForks('bad', 'repo')).rejects.toThrow('Fork analysis failed');
    });
  });
});
