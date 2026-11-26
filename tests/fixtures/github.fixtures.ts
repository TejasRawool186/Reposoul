/**
 * Deterministic test fixtures for GitHub API data.
 * Never use Math.random() or Date.now() inside fixtures — tests must be repeatable.
 */

import type { GitHubRepository, GitHubSearchResponse } from '../../src/types';

/** Build a minimal valid GitHubRepository object with safe defaults */
export function makeRepository(overrides: Partial<GitHubRepository> = {}): GitHubRepository {
  return {
    id: 1,
    name: 'test-repo',
    full_name: 'owner/test-repo',
    owner: { login: 'owner', type: 'User' },
    description: 'A test repository',
    html_url: 'https://github.com/owner/test-repo',
    clone_url: 'https://github.com/owner/test-repo.git',
    created_at: '2020-01-01T00:00:00Z',
    updated_at: '2022-01-01T00:00:00Z',
    pushed_at: '2022-01-01T00:00:00Z',
    size: 1000,
    stargazers_count: 100,
    watchers_count: 100,
    forks_count: 20,
    open_issues_count: 5,
    language: 'TypeScript',
    topics: [],
    archived: false,
    disabled: false,
    license: { key: 'mit', name: 'MIT License' },
    ...overrides,
  };
}

/** Clearly abandoned repository — last push 3 years ago, archived, many open issues */
export const abandonedRepo = makeRepository({
  id: 2,
  name: 'abandoned-repo',
  full_name: 'old-owner/abandoned-repo',
  pushed_at: '2021-01-01T00:00:00Z',
  updated_at: '2021-01-01T00:00:00Z',
  archived: true,
  open_issues_count: 42,
  stargazers_count: 500,
  forks_count: 80,
});

/** Active repository — recent push */
export const activeRepo = makeRepository({
  id: 3,
  name: 'active-repo',
  full_name: 'active-owner/active-repo',
  pushed_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  archived: false,
  open_issues_count: 2,
  stargazers_count: 50,
});

/** Repository with no license */
export const noLicenseRepo = makeRepository({
  id: 4,
  name: 'no-license-repo',
  full_name: 'owner/no-license-repo',
  license: null,
});

/** Repository with zero community metrics */
export const ghostRepo = makeRepository({
  id: 5,
  name: 'ghost-repo',
  full_name: 'owner/ghost-repo',
  stargazers_count: 0,
  forks_count: 0,
  open_issues_count: 0,
  pushed_at: '2019-01-01T00:00:00Z',
  description: null,
  language: null,
  topics: [],
  license: null,
});

/** Minimal GitHub search response */
export function makeSearchResponse(
  items: GitHubRepository[] = [makeRepository()],
  totalCount = items.length
): GitHubSearchResponse {
  return {
    total_count: totalCount,
    incomplete_results: false,
    items,
  };
}

/** Sample GitHub issues */
export const openIssue = {
  id: 101,
  number: 1,
  state: 'open',
  created_at: '2022-06-01T00:00:00Z',
  closed_at: null,
  pull_request: undefined,
};

export const closedIssue = {
  id: 102,
  number: 2,
  state: 'closed',
  created_at: '2022-06-01T00:00:00Z',
  closed_at: '2022-06-15T00:00:00Z',
  pull_request: undefined,
};

/** Sample commit objects */
export const recentCommit = {
  sha: 'abc123',
  commit: { author: { date: new Date().toISOString() } },
  author: { login: 'dev1' },
};

export const oldCommit = {
  sha: 'def456',
  commit: { author: { date: '2021-01-01T00:00:00Z' } },
  author: { login: 'dev2' },
};
