/**
 * Tests for GitHubService
 *
 * All HTTP calls are intercepted via vi.mock('axios') — no real network calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { GitHubService } from '../../../src/services/github';
import { makeRepository, makeSearchResponse } from '../../fixtures/github.fixtures';

// Mock axios.create so we control the returned instance
vi.mock('axios', async importOriginal => {
  const actual = await importOriginal<typeof import('axios')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn(),
      isAxiosError: actual.default.isAxiosError,
    },
  };
});

function makeAxiosInstance(overrides: Partial<Record<string, any>> = {}) {
  return {
    get: vi.fn(),
    post: vi.fn(),
    ...overrides,
  };
}

describe('GitHubService', () => {
  let mockApi: ReturnType<typeof makeAxiosInstance>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = makeAxiosInstance();
    vi.mocked(axios.create).mockReturnValue(mockApi as any);
  });

  // ─── Constructor / auth header ────────────────────────────────────────────

  describe('constructor auth header', () => {
    it('uses Bearer for oauth token', () => {
      new GitHubService({ oauthToken: 'gho_test', tokenType: 'oauth' });
      expect(vi.mocked(axios.create)).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer gho_test',
          }),
        })
      );
    });

    it('uses token prefix for PAT', () => {
      new GitHubService({ token: 'ghp_test', tokenType: 'pat' });
      expect(vi.mocked(axios.create)).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'token ghp_test',
          }),
        })
      );
    });

    it('auto-detects gho_ prefix as oauth', () => {
      const freshApi = makeAxiosInstance();
      vi.mocked(axios.create).mockReturnValueOnce(freshApi as any);
      new GitHubService({ token: 'gho_mytoken' });
      const callArgs = vi.mocked(axios.create).mock.calls.at(-1)![0] as any;
      expect(callArgs.headers.Authorization).toBe('Bearer gho_mytoken');
    });

    it('creates instance without auth when no token provided', () => {
      const freshApi = makeAxiosInstance();
      vi.mocked(axios.create).mockReturnValueOnce(freshApi as any);
      new GitHubService({});
      const callArgs = vi.mocked(axios.create).mock.calls.at(-1)![0] as any;
      expect(callArgs.headers.Authorization).toBeUndefined();
    });

    it('sets REPOSOUL User-Agent', () => {
      new GitHubService({});
      const callArgs = vi.mocked(axios.create).mock.calls[0][0] as any;
      expect(callArgs.headers['User-Agent']).toBe('REPOSOUL/1.0.0');
    });
  });

  // ─── searchRepositories ───────────────────────────────────────────────────

  describe('searchRepositories', () => {
    it('returns search response on success', async () => {
      const repo = makeRepository();
      const searchResponse = makeSearchResponse([repo], 1);
      mockApi.get.mockResolvedValueOnce({ data: searchResponse });

      const service = new GitHubService({});
      const result = await service.searchRepositories({ language: 'typescript' });

      expect(result.total_count).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].full_name).toBe(repo.full_name);
    });

    it('passes language filter in query', async () => {
      mockApi.get.mockResolvedValueOnce({ data: makeSearchResponse() });

      const service = new GitHubService({});
      await service.searchRepositories({ language: 'rust' });

      const callParams = mockApi.get.mock.calls[0][1]?.params;
      expect(callParams.q).toContain('language:rust');
    });

    it('passes stars filter in query', async () => {
      mockApi.get.mockResolvedValueOnce({ data: makeSearchResponse() });

      const service = new GitHubService({});
      await service.searchRepositories({ minStars: 50, maxStars: 500 });

      const callParams = mockApi.get.mock.calls[0][1]?.params;
      expect(callParams.q).toContain('stars:50..500');
    });

    it('passes pushed-before filter in query', async () => {
      mockApi.get.mockResolvedValueOnce({ data: makeSearchResponse() });

      const service = new GitHubService({});
      await service.searchRepositories({ pushedBefore: '2022-01-01' });

      const callParams = mockApi.get.mock.calls[0][1]?.params;
      expect(callParams.q).toContain('pushed:<2022-01-01');
    });

    it('throws descriptive error on API failure', async () => {
      const axiosError = Object.assign(new Error('Forbidden'), {
        isAxiosError: true,
        response: { data: { message: 'Bad credentials' }, status: 401 },
      });
      vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      mockApi.get.mockRejectedValueOnce(axiosError);

      const service = new GitHubService({});
      await expect(service.searchRepositories({})).rejects.toThrow('GitHub API Error: Bad credentials');
    });
  });

  // ─── getRepository ────────────────────────────────────────────────────────

  describe('getRepository', () => {
    it('fetches repository by owner/name', async () => {
      const repo = makeRepository({ name: 'my-repo', full_name: 'alice/my-repo' });
      mockApi.get.mockResolvedValueOnce({ data: repo });

      const service = new GitHubService({});
      const result = await service.getRepository('alice', 'my-repo');

      expect(mockApi.get).toHaveBeenCalledWith('/repos/alice/my-repo');
      expect(result.full_name).toBe('alice/my-repo');
    });

    it('throws descriptive error when repo not found', async () => {
      const axiosError = Object.assign(new Error('Not Found'), {
        isAxiosError: true,
        response: { data: { message: 'Not Found' }, status: 404 },
      });
      vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      mockApi.get.mockRejectedValueOnce(axiosError);

      const service = new GitHubService({});
      await expect(service.getRepository('nobody', 'ghost')).rejects.toThrow(
        'Failed to fetch repository: Not Found'
      );
    });
  });

  // ─── getRateLimit ─────────────────────────────────────────────────────────

  describe('getRateLimit', () => {
    it('returns rate limit data', async () => {
      const rateLimitData = {
        rate: { limit: 5000, remaining: 4900, reset: 1700000000 },
      };
      mockApi.get.mockResolvedValueOnce({ data: rateLimitData });

      const service = new GitHubService({});
      const result = await service.getRateLimit();

      expect(result.rate.limit).toBe(5000);
      expect(result.rate.remaining).toBe(4900);
    });
  });

  // ─── New organization methods ─────────────────────────────────────────────

  describe('getOrganization', () => {
    it('fetches org data via /orgs/:login', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { login: 'acme', type: 'Organization' } });

      const service = new GitHubService({});
      const result = await service.getOrganization('acme');

      expect(mockApi.get).toHaveBeenCalledWith('/orgs/acme');
      expect(result.login).toBe('acme');
    });
  });

  describe('getUser', () => {
    it('fetches user data via /users/:login', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { login: 'alice', type: 'User' } });

      const service = new GitHubService({});
      const result = await service.getUser('alice');

      expect(mockApi.get).toHaveBeenCalledWith('/users/alice');
      expect(result.login).toBe('alice');
    });
  });

  describe('getOrganizationRepos', () => {
    it('requests /orgs/:login/repos with correct params', async () => {
      mockApi.get.mockResolvedValueOnce({ data: [makeRepository()] });

      const service = new GitHubService({});
      await service.getOrganizationRepos('acme', 'public', 'updated', 'desc', 1, 30);

      expect(mockApi.get).toHaveBeenCalledWith(
        '/orgs/acme/repos',
        expect.objectContaining({
          params: { type: 'public', sort: 'updated', direction: 'desc', page: 1, per_page: 30 },
        })
      );
    });
  });
});
