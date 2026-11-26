/**
 * Tests for ReposoulHunter (core orchestrator)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReposoulHunter } from '../../../src/reposoul';
import { makeRepository, makeSearchResponse } from '../../fixtures/github.fixtures';

// Mock all service dependencies so no network calls happen
vi.mock('../../../src/services/github', () => ({
  GitHubService: vi.fn().mockImplementation(() => ({
    searchRepositoriesEnhanced: vi.fn().mockResolvedValue(makeSearchResponse()),
    getRepository: vi.fn().mockResolvedValue(makeRepository()),
    getRateLimit: vi.fn().mockResolvedValue({ rate: { limit: 5000, remaining: 4900, reset: 0 } }),
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
      abandonmentScore: 70,
      revivalPotential: 60,
      lastCommitAge: 400,
      issueResponseTime: -1,
      dependencyHealth: 'unknown',
      communityEngagement: 40,
      technicalComplexity: 'medium',
      marketRelevance: 55,
      reasons: [],
      recommendations: [],
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

describe('ReposoulHunter', () => {
  let hunter: ReposoulHunter;

  beforeEach(() => {
    vi.clearAllMocks();
    hunter = new ReposoulHunter();
  });

  // ─── Constructor ──────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('initializes without throwing when no auth config provided', () => {
      expect(() => new ReposoulHunter()).not.toThrow();
    });

    it('initializes with PAT token config', () => {
      expect(() => new ReposoulHunter({ token: 'ghp_test', tokenType: 'pat' })).not.toThrow();
    });

    it('initializes with OAuth token config', () => {
      expect(() => new ReposoulHunter({ oauthToken: 'gho_test', tokenType: 'oauth' })).not.toThrow();
    });

    it('exposes githubService publicly', () => {
      expect(hunter.githubService).toBeDefined();
    });
  });

  // ─── hunt ─────────────────────────────────────────────────────────────────

  describe('hunt', () => {
    it('returns a valid HuntResults shape', async () => {
      const results = await hunter.hunt({ language: 'typescript' });

      expect(results).toHaveProperty('query');
      expect(results).toHaveProperty('filters');
      expect(results).toHaveProperty('totalFound');
      expect(results).toHaveProperty('analyzed');
      expect(results).toHaveProperty('executionTime');
      expect(results).toHaveProperty('timestamp');
    });

    it('analyzed is an array', async () => {
      const results = await hunter.hunt({});
      expect(Array.isArray(results.analyzed)).toBe(true);
    });

    it('respects maxResults limit', async () => {
      const results = await hunter.hunt({}, 5);
      expect(results.analyzed.length).toBeLessThanOrEqual(5);
    });

    it('executionTime is a positive number', async () => {
      const results = await hunter.hunt({});
      expect(results.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('timestamp is a valid ISO string', async () => {
      const results = await hunter.hunt({});
      expect(() => new Date(results.timestamp)).not.toThrow();
      expect(new Date(results.timestamp).toISOString()).toBe(results.timestamp);
    });
  });

  // ─── analyzeRepository ────────────────────────────────────────────────────

  describe('analyzeRepository', () => {
    it('resolves for valid owner/repo format', async () => {
      const result = await hunter.analyzeRepository('owner/repo');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('abandonmentScore');
    });

    it('throws for invalid format without slash', async () => {
      await expect(hunter.analyzeRepository('invalid-no-slash')).rejects.toThrow(
        'Repository must be in format "owner/repo"'
      );
    });

    it('throws for empty string', async () => {
      await expect(hunter.analyzeRepository('')).rejects.toThrow(
        'Repository must be in format "owner/repo"'
      );
    });
  });

  // ─── ML delegation ────────────────────────────────────────────────────────

  describe('ML availability delegation', () => {
    it('isMLAvailable returns false when no models loaded', () => {
      expect(hunter.isMLAvailable()).toBe(false);
    });

    it('getMLModelInfo returns empty object when no models', () => {
      expect(hunter.getMLModelInfo()).toEqual({});
    });
  });

  // ─── checkRateLimit ───────────────────────────────────────────────────────

  describe('checkRateLimit', () => {
    it('delegates to githubService.getRateLimit', async () => {
      const result = await hunter.checkRateLimit();
      expect(result.rate.limit).toBe(5000);
    });
  });
});
