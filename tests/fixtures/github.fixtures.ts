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

// ─── RepositoryAnalysis fixture ───────────────────────────────────────────────

import type { RepositoryAnalysis, DependencyAnalysis, DependencyInfo, Vulnerability } from '../../src/types';

export function makeAnalysis(overrides: Partial<RepositoryAnalysis> = {}): RepositoryAnalysis {
  return {
    repository: makeRepository(),
    abandonmentScore: 65,
    revivalPotential: 70,
    lastCommitAge: 548,       // ~1.5 years
    issueResponseTime: 14,
    dependencyHealth: 'fair',
    communityEngagement: 45,
    technicalComplexity: 'medium',
    marketRelevance: 55,
    reasons: ['No commits in 1.5 years', 'Archived status'],
    recommendations: ['Update dependencies', 'Add CI/CD'],
    ...overrides,
  };
}

export const highPotentialAnalysis = makeAnalysis({
  abandonmentScore: 80,
  revivalPotential: 85,
  communityEngagement: 70,
  marketRelevance: 75,
  lastCommitAge: 730,
  repository: makeRepository({ stargazers_count: 2500, forks_count: 400 }),
});

export const lowPotentialAnalysis = makeAnalysis({
  abandonmentScore: 90,
  revivalPotential: 15,
  communityEngagement: 5,
  marketRelevance: 10,
  lastCommitAge: 1460,
  repository: makeRepository({ stargazers_count: 3, forks_count: 0, license: null }),
});

export const activeAnalysis = makeAnalysis({
  abandonmentScore: 20,
  revivalPotential: 50,
  communityEngagement: 60,
  marketRelevance: 60,
  lastCommitAge: 30,
});

function makeVulnerability(severity: Vulnerability['severity'] = 'high'): Vulnerability {
  return {
    severity,
    title: 'Test vulnerability',
    description: 'A test vulnerability',
    patchedVersions: '>=2.0.0',
    vulnerableVersions: '<2.0.0',
    source: 'npm',
  };
}

function makeDependencyInfo(overrides: Partial<DependencyInfo> = {}): DependencyInfo {
  return {
    name: 'test-package',
    currentVersion: '1.0.0',
    latestVersion: '2.0.0',
    isOutdated: true,
    vulnerabilities: [],
    securityScore: 80,
    type: 'dependency',
    ...overrides,
  };
}

export function makeDependencyAnalysis(overrides: Partial<DependencyAnalysis> = {}): DependencyAnalysis {
  return {
    totalDependencies: 10,
    outdatedDependencies: 3,
    vulnerableDependencies: 1,
    criticalVulnerabilities: 0,
    dependencyHealth: 'fair',
    healthScore: 70,
    dependencies: [
      makeDependencyInfo({ name: 'axios', currentVersion: '1.0.0', latestVersion: '1.5.0', isOutdated: true }),
      makeDependencyInfo({ name: 'lodash', currentVersion: '4.0.0', latestVersion: '4.17.21', isOutdated: true }),
      makeDependencyInfo({ name: 'react', currentVersion: '17.0.0', latestVersion: '18.0.0', isOutdated: true,
        vulnerabilities: [makeVulnerability('high')] }),
    ],
    recommendations: ['Update lodash to 4.17.21', 'Fix react vulnerability'],
    lastUpdated: new Date('2026-01-01'),
    ...overrides,
  };
}

export const criticalDepAnalysis = makeDependencyAnalysis({
  criticalVulnerabilities: 2,
  vulnerableDependencies: 3,
  outdatedDependencies: 25,
  healthScore: 20,
  dependencyHealth: 'critical',
  dependencies: [
    makeDependencyInfo({ name: 'old-pkg', vulnerabilities: [makeVulnerability('critical')] }),
  ],
});
