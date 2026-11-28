import { GitHubService } from './github';
import { RepositoryAnalyzer } from './analyzer';
import { QueryUnderstandingService } from './query-understanding';
import { EmbeddingService } from './embedding-service';
import { RepositoryRanker, DEFAULT_WEIGHTS, RankingWeights } from './repository-ranker';
import {
  SearchIntent,
  SemanticSearchResult,
  RankedRepository,
  GitHubRepository,
  RepositoryAnalysis,
  SearchFilters,
  AIProviderConfig,
} from '../types';

export interface SemanticDiscoveryOptions {
  aiConfig?: AIProviderConfig;
  rankingWeights?: RankingWeights;
  /** Maximum GitHub candidates to fetch before ranking (default: 30) */
  maxCandidates?: number;
  /** Maximum ranked results to return (default: 12) */
  maxResults?: number;
  /** Whether to run full REPOSOUL analysis on candidates (slower but more accurate) */
  analyzeAll?: boolean;
}

/**
 * SemanticDiscoveryService
 *
 * Orchestrates the full AI-powered discovery pipeline:
 * 1. Interpret natural-language query → SearchIntent
 * 2. Build GitHub search filters from intent
 * 3. Fetch candidate repositories
 * 4. Generate embeddings for query and candidates
 * 5. Optionally run REPOSOUL analysis on candidates
 * 6. Hybrid rank results
 * 7. Return ranked results with match explanations
 */
export class SemanticDiscoveryService {
  private readonly queryService: QueryUnderstandingService;
  private readonly embeddingService: EmbeddingService;
  private readonly ranker: RepositoryRanker;
  private readonly maxCandidates: number;
  private readonly maxResults: number;
  private readonly analyzeAll: boolean;

  constructor(
    private readonly github: GitHubService,
    private readonly analyzer: RepositoryAnalyzer,
    options: SemanticDiscoveryOptions = {},
  ) {
    this.queryService = new QueryUnderstandingService(options.aiConfig);
    this.embeddingService = new EmbeddingService(options.aiConfig);
    this.ranker = new RepositoryRanker(options.rankingWeights ?? DEFAULT_WEIGHTS);
    this.maxCandidates = options.maxCandidates ?? 30;
    this.maxResults = options.maxResults ?? 12;
    this.analyzeAll = options.analyzeAll ?? false;
  }

  /**
   * Run the complete semantic discovery pipeline for a natural-language query.
   */
  async search(query: string): Promise<SemanticSearchResult> {
    const start = Date.now();

    // 1. Interpret query
    const intent = await this.queryService.interpret(query);

    // 2. Build GitHub filters
    const filters = this.intentToFilters(intent);

    // 3. Fetch candidates (deduplicated)
    const candidates = await this.fetchCandidates(filters, intent);

    // 4. Generate embeddings
    const queryEmbedding = await this.embeddingService.embed(query);
    const repoEmbeddings = new Map<string, import('../types').EmbeddingResult>();

    await Promise.allSettled(
      candidates.map(async repo => {
        try {
          const emb = await this.embeddingService.embedRepository(repo);
          repoEmbeddings.set(repo.full_name, emb);
        } catch {
          // Skip embedding failure — ranker uses neutral score for missing embeddings
        }
      }),
    );

    // 5. Optional REPOSOUL analysis
    const analyses = new Map<string, RepositoryAnalysis>();
    if (this.analyzeAll && candidates.length <= 15) {
      // Only analyze if few candidates — full analysis is expensive
      await Promise.allSettled(
        candidates.map(async repo => {
          try {
            const a = await this.analyzer.analyzeRepository(repo);
            analyses.set(repo.full_name, a);
          } catch {
            // Analysis failure is non-fatal
          }
        }),
      );
    } else {
      // Light analysis: use only what we have from GitHub metadata
      for (const repo of candidates) {
        analyses.set(repo.full_name, this.lightAnalysis(repo));
      }
    }

    // 6. Rank
    const ranked = this.ranker.rank(candidates, analyses, queryEmbedding, repoEmbeddings, intent);

    // 7. Trim to maxResults
    const results = ranked.slice(0, this.maxResults);

    return {
      intent,
      results,
      totalCandidates: candidates.length,
      executionTimeMs: Date.now() - start,
      timestamp: new Date().toISOString(),
      aiProvider: this.queryService.isAvailable ? 'groq' : 'fallback',
      embeddingModel: this.embeddingService.isAvailable
        ? 'nomic-embed-text-v1_5'
        : 'deterministic-bow-256',
    };
  }

  // ─── Filter building ──────────────────────────────────────────────────────

  private intentToFilters(intent: SearchIntent): SearchFilters {
    const filters: SearchFilters = {};

    // Use first detected language if any
    if (intent.languages.length > 0) {
      filters.language = intent.languages[0];
    }

    // Stars
    if (intent.minimumStars !== null) filters.minStars = intent.minimumStars;
    if (intent.maximumStars !== null) filters.maxStars = intent.maximumStars;

    // Pushed-before from intent, or derive from abandonment preference
    if (intent.pushedBefore) {
      filters.pushedBefore = intent.pushedBefore;
    } else if (intent.abandonmentPreference === 'definitely_abandoned') {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 3);
      filters.pushedBefore = d.toISOString().split('T')[0];
    } else if (intent.abandonmentPreference === 'likely_abandoned') {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      filters.pushedBefore = d.toISOString().split('T')[0];
    }

    // Default minimum stars to avoid completely unstarred repos
    if (!filters.minStars && intent.minimumStars === null) {
      filters.minStars = 10;
    }

    return filters;
  }

  // ─── Candidate retrieval ──────────────────────────────────────────────────

  private async fetchCandidates(
    filters: SearchFilters,
    intent: SearchIntent,
  ): Promise<GitHubRepository[]> {
    const seen = new Set<number>();
    const all: GitHubRepository[] = [];

    // Primary search with language filter
    try {
      const primary = await this.github.searchRepositories(
        filters,
        1,
        Math.min(this.maxCandidates, 30),
      );
      for (const r of primary.items) {
        if (!seen.has(r.id)) { seen.add(r.id); all.push(r); }
      }
    } catch (err) {
      console.warn('[SemanticDiscovery] Primary search failed:', err instanceof Error ? err.message : err);
    }

    // Secondary search using keywords if we have room
    if (all.length < this.maxCandidates && intent.keywords.length > 0) {
      const keywordFilter: SearchFilters = {
        ...filters,
        language: undefined, // broader search without language constraint
      };
      try {
        const secondary = await this.github.searchRepositories(
          keywordFilter,
          1,
          Math.min(this.maxCandidates - all.length, 15),
        );
        for (const r of secondary.items) {
          if (!seen.has(r.id)) { seen.add(r.id); all.push(r); }
        }
      } catch {
        // non-fatal
      }
    }

    return all;
  }

  // ─── Light analysis from GitHub metadata ─────────────────────────────────

  /**
   * Approximate analysis from GitHub API data — no additional API calls.
   * Used when full analysis is too expensive for all candidates.
   */
  private lightAnalysis(repo: GitHubRepository): RepositoryAnalysis {
    const now = Date.now();
    const lastCommitAge = repo.pushed_at
      ? Math.floor((now - new Date(repo.pushed_at).getTime()) / 86400000)
      : 999;

    const abandonmentScore = Math.min(100,
      (lastCommitAge > 730 ? 50 : lastCommitAge > 365 ? 30 : 10)
      + (repo.archived ? 30 : 0)
      + (repo.open_issues_count > 50 ? 10 : 0),
    );

    const revivalPotential = Math.min(100,
      (repo.stargazers_count > 1000 ? 40 : repo.stargazers_count > 100 ? 25 : 10)
      + (repo.forks_count > 100 ? 20 : repo.forks_count > 10 ? 10 : 0)
      + (repo.license ? 15 : 0)
      + (abandonmentScore > 40 ? 15 : 0),
    );

    return {
      repository: repo,
      abandonmentScore,
      revivalPotential,
      lastCommitAge,
      issueResponseTime: -1,
      dependencyHealth: 'unknown',
      communityEngagement: Math.min(100, Math.round(
        (Math.log10(repo.stargazers_count + 1) / Math.log10(10001)) * 100,
      )),
      technicalComplexity: repo.size > 20000 ? 'high' : repo.size > 5000 ? 'medium' : 'low',
      marketRelevance: Math.min(100, Math.round(
        (Math.log10(repo.stargazers_count + 1) / Math.log10(10001)) * 100,
      )),
      reasons: lastCommitAge > 365 ? [`No commits in ${(lastCommitAge / 365).toFixed(1)} years`] : [],
      recommendations: revivalPotential > 60 ? ['High revival potential'] : [],
    };
  }
}
