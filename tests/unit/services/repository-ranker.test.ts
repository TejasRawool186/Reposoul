/**
 * Tests for RepositoryRanker
 *
 * No external API calls — all inputs are deterministic fixtures.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RepositoryRanker, DEFAULT_WEIGHTS, RankingWeights } from '../../../src/services/repository-ranker';
import {
  makeRepository,
  makeAnalysis,
  abandonedRepo,
  activeRepo,
  highPotentialAnalysis,
  lowPotentialAnalysis,
  criticalDepAnalysis,
  makeDependencyAnalysis,
} from '../../fixtures/github.fixtures';
import type { EmbeddingResult, SearchIntent } from '../../../src/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEmbedding(vector: number[], inputText = 'query'): EmbeddingResult {
  return { vector, model: 'test', dimensions: vector.length, inputText };
}

/** Build a minimal valid SearchIntent */
function makeIntent(overrides: Partial<SearchIntent> = {}): SearchIntent {
  return {
    originalQuery: 'abandoned python ml libraries',
    keywords: ['machine', 'learning', 'library'],
    languages: ['Python'],
    domains: [],
    minimumStars: null,
    maximumStars: null,
    abandonmentPreference: 'likely_abandoned',
    technicalIssues: [],
    sortPreference: 'revival_potential',
    pushedBefore: null,
    confidence: 0.8,
    ...overrides,
  };
}

/** Normalised unit vector in the direction of the given 2D angle (radians) */
function unitVec2(angle: number): number[] {
  return [Math.cos(angle), Math.sin(angle)];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RepositoryRanker', () => {

  // ─── Constructor validation ────────────────────────────────────────────────

  describe('constructor', () => {
    it('accepts valid DEFAULT_WEIGHTS', () => {
      expect(() => new RepositoryRanker(DEFAULT_WEIGHTS)).not.toThrow();
    });

    it('throws when weights do not sum to 1.0', () => {
      const bad: RankingWeights = {
        semanticSimilarity: 0.5,
        abandonmentScore: 0.5,
        revivalPotential: 0.5,
        technicalOpportunity: 0.5,
      };
      expect(() => new RepositoryRanker(bad)).toThrow(/sum to 1.0/);
    });

    it('accepts custom weights that sum to 1.0', () => {
      const custom: RankingWeights = {
        semanticSimilarity: 0.5,
        abandonmentScore: 0.3,
        revivalPotential: 0.1,
        technicalOpportunity: 0.1,
      };
      expect(() => new RepositoryRanker(custom)).not.toThrow();
    });
  });

  // ─── Basic ranking ─────────────────────────────────────────────────────────

  describe('rank', () => {
    let ranker: RepositoryRanker;
    const intent = makeIntent();

    // Unit vectors at 0° and 45°
    const queryVec = unitVec2(0);  // [1, 0]
    const queryEmb = makeEmbedding(queryVec, 'query');

    beforeEach(() => {
      ranker = new RepositoryRanker(DEFAULT_WEIGHTS);
    });

    it('returns one result per candidate', () => {
      const repos = [makeRepository({ id: 1 }), makeRepository({ id: 2 }), makeRepository({ id: 3 })];
      const analyses = new Map<string, any>();
      const repEmbs = new Map<string, EmbeddingResult>();

      const results = ranker.rank(repos, analyses, queryEmb, repEmbs, intent);
      expect(results.length).toBe(3);
    });

    it('assigns rank 1 to the top result', () => {
      const repos = [makeRepository({ id: 1 })];
      const results = ranker.rank(repos, new Map(), queryEmb, new Map(), intent);
      expect(results[0].rank).toBe(1);
    });

    it('rank values are sequential starting at 1', () => {
      const repos = [makeRepository({ id: 1 }), makeRepository({ id: 2 }), makeRepository({ id: 3 })];
      const results = ranker.rank(repos, new Map(), queryEmb, new Map(), intent);
      const ranks = results.map(r => r.rank).sort((a, b) => a - b);
      expect(ranks).toEqual([1, 2, 3]);
    });

    it('results are sorted descending by hybridScore', () => {
      const repos = [makeRepository({ id: 1 }), makeRepository({ id: 2 })];
      const analyses = new Map<string, any>([
        ['owner/test-repo', makeAnalysis({ abandonmentScore: 10, revivalPotential: 10 })],
      ]);
      const analyses2 = new Map<string, any>([
        ['owner/test-repo', makeAnalysis({ abandonmentScore: 90, revivalPotential: 90 })],
      ]);
      const all = new Map([...analyses, ...analyses2]);

      const results = ranker.rank(repos, all, queryEmb, new Map(), intent);
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].hybridScore).toBeGreaterThanOrEqual(results[i + 1].hybridScore);
      }
    });

    it('hybridScore is in range 0–100', () => {
      const repos = [abandonedRepo, activeRepo];
      const analyses = new Map<string, any>([
        [abandonedRepo.full_name, highPotentialAnalysis],
        [activeRepo.full_name, lowPotentialAnalysis],
      ]);
      const results = ranker.rank(repos, analyses, queryEmb, new Map(), intent);
      for (const r of results) {
        expect(r.hybridScore).toBeGreaterThanOrEqual(0);
        expect(r.hybridScore).toBeLessThanOrEqual(100);
      }
    });

    it('handles empty candidates array', () => {
      const results = ranker.rank([], new Map(), queryEmb, new Map(), intent);
      expect(results).toEqual([]);
    });
  });

  // ─── Semantic score influence ───────────────────────────────────────────────

  describe('semantic score influence', () => {
    it('repo with high cosine similarity gets higher score than unrelated repo', () => {
      const ranker = new RepositoryRanker(DEFAULT_WEIGHTS);
      const intent = makeIntent();

      // Query points at [1, 0]
      const queryEmb = makeEmbedding([1, 0], 'query');

      // Repo A aligns with query at 0° → cos = 1.0
      const repoA = makeRepository({ id: 1, full_name: 'owner/repo-a' });
      // Repo B is orthogonal at 90° → cos = 0
      const repoB = makeRepository({ id: 2, full_name: 'owner/repo-b' });

      const analyses = new Map<string, any>([
        ['owner/repo-a', makeAnalysis({ abandonmentScore: 50, revivalPotential: 50 })],
        ['owner/repo-b', makeAnalysis({ abandonmentScore: 50, revivalPotential: 50 })],
      ]);

      const repoEmbs = new Map<string, EmbeddingResult>([
        ['owner/repo-a', makeEmbedding([1, 0], 'repo-a')],  // parallel → sim = 1
        ['owner/repo-b', makeEmbedding([0, 1], 'repo-b')],  // orthogonal → sim = 0
      ]);

      const results = ranker.rank([repoA, repoB], analyses, queryEmb, repoEmbs, intent);
      const scoreA = results.find(r => r.repository.full_name === 'owner/repo-a')!.hybridScore;
      const scoreB = results.find(r => r.repository.full_name === 'owner/repo-b')!.hybridScore;
      expect(scoreA).toBeGreaterThan(scoreB);
    });

    it('uses neutral 0.5 semantic score when repo embedding is missing', () => {
      const ranker = new RepositoryRanker(DEFAULT_WEIGHTS);
      const intent = makeIntent();
      const queryEmb = makeEmbedding([1, 0]);

      const repoNoEmb = makeRepository({ id: 1, full_name: 'owner/no-emb' });
      const analyses = new Map<string, any>([
        ['owner/no-emb', makeAnalysis({ abandonmentScore: 50, revivalPotential: 50 })],
      ]);

      const results = ranker.rank([repoNoEmb], analyses, queryEmb, new Map(), intent);
      // Neutral semantic 0.5, neutral abandonment/revival 0.5, techOpportunity 0 (no dep data):
      // hybrid = 0.35*0.5 + 0.30*0.5 + 0.25*0.5 + 0.10*0 = 0.45 → 45
      expect(results[0].hybridScore).toBe(45);
    });
  });

  // ─── Analysis influence ─────────────────────────────────────────────────────

  describe('analysis score influence', () => {
    it('high abandonment + high revival beats low scores with same semantic', () => {
      const ranker = new RepositoryRanker(DEFAULT_WEIGHTS);
      const intent = makeIntent();
      const queryEmb = makeEmbedding([1, 0]);

      const goodRepo = makeRepository({ id: 1, full_name: 'owner/good' });
      const badRepo  = makeRepository({ id: 2, full_name: 'owner/bad' });

      const analyses = new Map<string, any>([
        ['owner/good', makeAnalysis({ abandonmentScore: 90, revivalPotential: 90 })],
        ['owner/bad',  makeAnalysis({ abandonmentScore: 10, revivalPotential: 10 })],
      ]);
      // Same embeddings for both — only analysis differs
      const repoEmbs = new Map<string, EmbeddingResult>([
        ['owner/good', makeEmbedding([1, 0])],
        ['owner/bad',  makeEmbedding([1, 0])],
      ]);

      const results = ranker.rank([goodRepo, badRepo], analyses, queryEmb, repoEmbs, intent);
      const good = results.find(r => r.repository.full_name === 'owner/good')!;
      const bad  = results.find(r => r.repository.full_name === 'owner/bad')!;
      expect(good.hybridScore).toBeGreaterThan(bad.hybridScore);
    });

    it('uses neutral analysis scores when analysis is missing', () => {
      const ranker = new RepositoryRanker(DEFAULT_WEIGHTS);
      const intent = makeIntent();
      const queryEmb = makeEmbedding([1, 0]);

      const repo = makeRepository({ id: 1, full_name: 'owner/no-analysis' });
      const results = ranker.rank([repo], new Map(), queryEmb, new Map(), intent);
      // All components neutral/default → hybridScore around 45 (tech opportunity = 0 when no analysis)
      expect(results[0].hybridScore).toBeGreaterThanOrEqual(40);
      expect(results[0].hybridScore).toBeLessThanOrEqual(60);
    });
  });

  // ─── Technical opportunity ─────────────────────────────────────────────────

  describe('technical opportunity scoring', () => {
    it('critical vulnerabilities increase technical opportunity score', () => {
      const ranker = new RepositoryRanker(DEFAULT_WEIGHTS);
      const intent = makeIntent();
      const queryEmb = makeEmbedding([1, 0]);

      const vulnRepo  = makeRepository({ id: 1, full_name: 'owner/vuln' });
      const cleanRepo = makeRepository({ id: 2, full_name: 'owner/clean' });

      const vulnAnalysis = makeAnalysis({
        abandonmentScore: 50,
        revivalPotential: 50,
        dependencyAnalysis: makeDependencyAnalysis({ criticalVulnerabilities: 2 }),
      });
      const cleanAnalysis = makeAnalysis({
        abandonmentScore: 50,
        revivalPotential: 50,
        dependencyAnalysis: makeDependencyAnalysis({ criticalVulnerabilities: 0, vulnerableDependencies: 0, outdatedDependencies: 0 }),
      });

      const analyses = new Map<string, any>([
        ['owner/vuln',  vulnAnalysis],
        ['owner/clean', cleanAnalysis],
      ]);
      const repoEmbs = new Map<string, EmbeddingResult>([
        ['owner/vuln',  makeEmbedding([1, 0])],
        ['owner/clean', makeEmbedding([1, 0])],
      ]);

      const results = ranker.rank([vulnRepo, cleanRepo], analyses, queryEmb, repoEmbs, intent);
      const vulnScore  = results.find(r => r.repository.full_name === 'owner/vuln')!.hybridScore;
      const cleanScore = results.find(r => r.repository.full_name === 'owner/clean')!.hybridScore;
      expect(vulnScore).toBeGreaterThan(cleanScore);
    });

    it('high technical complexity increases technical opportunity', () => {
      const ranker = new RepositoryRanker(DEFAULT_WEIGHTS);
      const intent = makeIntent();
      const queryEmb = makeEmbedding([1, 0]);

      const complex = makeRepository({ id: 1, full_name: 'owner/complex' });
      const simple  = makeRepository({ id: 2, full_name: 'owner/simple' });

      const analyses = new Map<string, any>([
        ['owner/complex', makeAnalysis({ abandonmentScore: 50, revivalPotential: 50, technicalComplexity: 'high' })],
        ['owner/simple',  makeAnalysis({ abandonmentScore: 50, revivalPotential: 50, technicalComplexity: 'low' })],
      ]);
      const repoEmbs = new Map<string, EmbeddingResult>([
        ['owner/complex', makeEmbedding([1, 0])],
        ['owner/simple',  makeEmbedding([1, 0])],
      ]);

      const results = ranker.rank([complex, simple], analyses, queryEmb, repoEmbs, intent);
      const complexScore = results.find(r => r.repository.full_name === 'owner/complex')!.hybridScore;
      const simpleScore  = results.find(r => r.repository.full_name === 'owner/simple')!.hybridScore;
      expect(complexScore).toBeGreaterThan(simpleScore);
    });
  });

  // ─── matchReason ───────────────────────────────────────────────────────────

  describe('matchReason', () => {
    it('every result has a non-empty matchReason', () => {
      const ranker = new RepositoryRanker(DEFAULT_WEIGHTS);
      const repos = [makeRepository({ id: 1 }), abandonedRepo];
      const results = ranker.rank(repos, new Map(), makeEmbedding([1, 0]), new Map(), makeIntent());
      for (const r of results) {
        expect(r.matchReason.length).toBeGreaterThan(0);
      }
    });

    it('mentions language when present', () => {
      const ranker = new RepositoryRanker(DEFAULT_WEIGHTS);
      const repo = makeRepository({ id: 1, language: 'Python' });
      const analyses = new Map<string, any>([
        [repo.full_name, makeAnalysis()],
      ]);
      const results = ranker.rank([repo], analyses, makeEmbedding([1, 0]), new Map(), makeIntent());
      expect(results[0].matchReason).toContain('Python');
    });

    it('mentions stars when >= 1000', () => {
      const ranker = new RepositoryRanker(DEFAULT_WEIGHTS);
      const repo = makeRepository({ id: 1, stargazers_count: 2500 });
      const results = ranker.rank([repo], new Map(), makeEmbedding([1, 0]), new Map(), makeIntent());
      expect(results[0].matchReason).toMatch(/2\.5k stars/);
    });
  });

  // ─── technicalProblems ─────────────────────────────────────────────────────

  describe('technicalProblems', () => {
    it('empty array when no analysis', () => {
      const ranker = new RepositoryRanker(DEFAULT_WEIGHTS);
      const results = ranker.rank([makeRepository()], new Map(), makeEmbedding([1, 0]), new Map(), makeIntent());
      expect(results[0].technicalProblems).toEqual([]);
    });

    it('reports outdated dependencies', () => {
      const ranker = new RepositoryRanker(DEFAULT_WEIGHTS);
      const repo = makeRepository({ id: 1, full_name: 'owner/outdated' });
      const analysis = makeAnalysis({
        dependencyAnalysis: makeDependencyAnalysis({ outdatedDependencies: 5 }),
      });
      const analyses = new Map<string, any>([[repo.full_name, analysis]]);
      const results = ranker.rank([repo], analyses, makeEmbedding([1, 0]), new Map(), makeIntent());
      expect(results[0].technicalProblems.some(p => p.includes('outdated'))).toBe(true);
    });

    it('reports critical vulnerabilities', () => {
      const ranker = new RepositoryRanker(DEFAULT_WEIGHTS);
      const repo = makeRepository({ id: 1, full_name: 'owner/vuln' });
      const analysis = makeAnalysis({
        dependencyAnalysis: criticalDepAnalysis,
      });
      const analyses = new Map<string, any>([[repo.full_name, analysis]]);
      const results = ranker.rank([repo], analyses, makeEmbedding([1, 0]), new Map(), makeIntent());
      expect(results[0].technicalProblems.some(p => p.includes('critical'))).toBe(true);
    });

    it('reports no commits age when lastCommitAge > 365', () => {
      const ranker = new RepositoryRanker(DEFAULT_WEIGHTS);
      const repo = makeRepository({ id: 1, full_name: 'owner/stale' });
      const analysis = makeAnalysis({ lastCommitAge: 730 });
      const analyses = new Map<string, any>([[repo.full_name, analysis]]);
      const results = ranker.rank([repo], analyses, makeEmbedding([1, 0]), new Map(), makeIntent());
      expect(results[0].technicalProblems.some(p => p.includes('commits'))).toBe(true);
    });
  });

  // ─── semanticScore field ───────────────────────────────────────────────────

  describe('semanticScore field', () => {
    it('semanticScore is 0.5 (neutral) when no repo embedding', () => {
      const ranker = new RepositoryRanker(DEFAULT_WEIGHTS);
      const results = ranker.rank([makeRepository()], new Map(), makeEmbedding([1, 0]), new Map(), makeIntent());
      expect(results[0].semanticScore).toBe(0.5);
    });

    it('semanticScore is between 0 and 1', () => {
      const ranker = new RepositoryRanker(DEFAULT_WEIGHTS);
      const repo = makeRepository({ full_name: 'owner/test-repo' });
      const repoEmbs = new Map<string, EmbeddingResult>([
        ['owner/test-repo', makeEmbedding([0.6, 0.8])], // unit vector
      ]);
      const results = ranker.rank([repo], new Map(), makeEmbedding([1, 0]), repoEmbs, makeIntent());
      expect(results[0].semanticScore).toBeGreaterThanOrEqual(0);
      expect(results[0].semanticScore).toBeLessThanOrEqual(1);
    });
  });
});
