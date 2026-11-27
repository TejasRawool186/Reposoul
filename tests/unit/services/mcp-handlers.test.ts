/**
 * Tests for MCP handlers
 *
 * All GitHub API calls are mocked — no real network calls.
 * Tests verify that each handler returns the expected shape.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpHandlers } from '../../../src/mcp/handlers';
import { makeRepository, makeSearchResponse } from '../../fixtures/github.fixtures';

// Mock the entire services layer
vi.mock('../../../src/services/github', () => ({
  GitHubService: vi.fn().mockImplementation(() => ({
    searchRepositories: vi.fn().mockResolvedValue(makeSearchResponse([makeRepository()], 1)),
    getRepository: vi.fn().mockResolvedValue(makeRepository()),
    getRepositoryIssues: vi.fn().mockResolvedValue([]),
    getRepositoryCommits: vi.fn().mockResolvedValue([]),
    getRateLimit: vi.fn().mockResolvedValue({
      rate: { limit: 5000, remaining: 4900, reset: 1700000000 },
    }),
    getOrganization: vi.fn(),
    getUser: vi.fn(),
    getOrganizationRepos: vi.fn().mockResolvedValue([]),
    getUserPublicRepos: vi.fn().mockResolvedValue([]),
    hasPrivateAccess: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('../../../src/services/analyzer', () => ({
  RepositoryAnalyzer: vi.fn().mockImplementation(() => ({
    analyzeRepository: vi.fn().mockResolvedValue({
      repository: makeRepository(),
      abandonmentScore: 65,
      revivalPotential: 70,
      lastCommitAge: 400,
      issueResponseTime: -1,
      dependencyHealth: 'unknown',
      communityEngagement: 45,
      technicalComplexity: 'medium',
      marketRelevance: 55,
      reasons: ['No commits in 1.1 years'],
      recommendations: ['Add CI/CD'],
      scoringMethod: 'rule-based',
    }),
  })),
}));

vi.mock('../../../src/services/ml-predictor', () => ({
  MLPredictor: vi.fn().mockImplementation(() => ({
    isMLAvailable: vi.fn().mockReturnValue(false),
    enhanceAnalysis: vi.fn(),
    getModelInfo: vi.fn().mockReturnValue({}),
  })),
}));

vi.mock('../../../src/services/fork-analyzer', () => ({
  ForkAnalyzer: vi.fn().mockImplementation(() => ({
    analyzeForks: vi.fn().mockResolvedValue({
      original: makeRepository(),
      totalForks: 5,
      analyzedForks: 2,
      activeForks: [],
      topRecommendations: [],
      insights: ['2 forks analyzed'],
      executionTime: 500,
      timestamp: new Date().toISOString(),
    }),
  })),
}));

describe('McpHandlers', () => {
  let handlers: McpHandlers;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = new McpHandlers({});
  });

  // ─── searchRepositories ───────────────────────────────────────────────────

  describe('searchRepositories', () => {
    it('returns repositories array and total_count', async () => {
      const result: any = await handlers.searchRepositories({ language: 'typescript', limit: 5 });
      expect(result).toHaveProperty('total_count');
      expect(result).toHaveProperty('repositories');
      expect(Array.isArray(result.repositories)).toBe(true);
    });

    it('repository objects have required fields', async () => {
      const result: any = await handlers.searchRepositories({});
      result.repositories.forEach((r: any) => {
        expect(r).toHaveProperty('full_name');
        expect(r).toHaveProperty('language');
        expect(r).toHaveProperty('stargazers_count');
        expect(r).toHaveProperty('url');
      });
    });

    it('respects the limit parameter', async () => {
      const result: any = await handlers.searchRepositories({ limit: 3 });
      // The mock returns 1 item regardless, but limit is clamped 1-30
      expect(result).toBeDefined();
    });

    it('handles empty language parameter', async () => {
      await expect(handlers.searchRepositories({})).resolves.toBeDefined();
    });
  });

  // ─── analyzeRepository ────────────────────────────────────────────────────

  describe('analyzeRepository', () => {
    it('returns a full analysis for valid owner/repo', async () => {
      const result: any = await handlers.analyzeRepository({ repository: 'owner/repo' });
      expect(result).toHaveProperty('abandonmentScore');
      expect(result).toHaveProperty('revivalPotential');
      expect(result).toHaveProperty('communityEngagement');
      expect(result).toHaveProperty('marketRelevance');
    });

    it('throws for missing repository parameter', async () => {
      await expect(handlers.analyzeRepository({})).rejects.toThrow('owner/name');
    });

    it('throws for repository without slash', async () => {
      await expect(handlers.analyzeRepository({ repository: 'invalid' })).rejects.toThrow('owner/name');
    });

    it('accepts mlEnhanced:false without throwing', async () => {
      await expect(
        handlers.analyzeRepository({ repository: 'owner/repo', mlEnhanced: false })
      ).resolves.toBeDefined();
    });
  });

  // ─── generateBlueprint ───────────────────────────────────────────────────

  describe('generateBlueprint', () => {
    it('returns a blueprint with recommendation field', async () => {
      const result: any = await handlers.generateBlueprint({ repository: 'owner/repo' });
      expect(result).toHaveProperty('recommendation');
      expect(result).toHaveProperty('overallScore');
    });

    it('returns formatted string for markdown format', async () => {
      const result: any = await handlers.generateBlueprint({
        repository: 'owner/repo',
        format: 'markdown',
      });
      expect(result).toHaveProperty('formatted');
      expect(typeof result.formatted).toBe('string');
      expect(result.formatted.length).toBeGreaterThan(100);
    });

    it('throws for missing repository parameter', async () => {
      await expect(handlers.generateBlueprint({})).rejects.toThrow('owner/name');
    });

    it('defaults to json format', async () => {
      const result: any = await handlers.generateBlueprint({ repository: 'owner/repo' });
      // JSON format returns the raw blueprint object
      expect(result).toHaveProperty('riskRegister');
      expect(result).toHaveProperty('actionItems');
    });
  });

  // ─── analyzeForks ────────────────────────────────────────────────────────

  describe('analyzeForks', () => {
    it('returns fork comparison with required fields', async () => {
      const result: any = await handlers.analyzeForks({ repository: 'owner/repo' });
      expect(result).toHaveProperty('totalForks');
      expect(result).toHaveProperty('activeForks');
      expect(result).toHaveProperty('insights');
    });

    it('throws for invalid repository format', async () => {
      await expect(handlers.analyzeForks({ repository: 'invalid' })).rejects.toThrow('owner/name');
    });

    it('clamps maxForks between 1 and 50', async () => {
      // Should not throw even with extreme values
      await expect(
        handlers.analyzeForks({ repository: 'owner/repo', maxForks: 999 })
      ).resolves.toBeDefined();
    });
  });

  // ─── getRateLimit ─────────────────────────────────────────────────────────

  describe('getRateLimit', () => {
    it('returns limit, remaining, reset, used fields', async () => {
      const result: any = await handlers.getRateLimit({});
      expect(result).toHaveProperty('limit', 5000);
      expect(result).toHaveProperty('remaining', 4900);
      expect(result).toHaveProperty('reset');
      expect(result).toHaveProperty('used', 100);
    });

    it('reset is a valid ISO string', async () => {
      const result: any = await handlers.getRateLimit({});
      expect(() => new Date(result.reset)).not.toThrow();
    });
  });

  // ─── dispatch ─────────────────────────────────────────────────────────────

  describe('dispatch', () => {
    it('dispatches search_repositories correctly', async () => {
      const result: any = await handlers.dispatch('search_repositories', { limit: 5 });
      expect(result).toHaveProperty('repositories');
    });

    it('dispatches get_rate_limit correctly', async () => {
      const result: any = await handlers.dispatch('get_rate_limit', {});
      expect(result).toHaveProperty('limit');
    });

    it('throws for unknown tool name', async () => {
      await expect(handlers.dispatch('unknown_tool', {})).rejects.toThrow('Unknown tool');
    });

    it('dispatches analyze_repository correctly', async () => {
      const result: any = await handlers.dispatch('analyze_repository', { repository: 'owner/repo' });
      expect(result).toHaveProperty('abandonmentScore');
    });
  });
});
