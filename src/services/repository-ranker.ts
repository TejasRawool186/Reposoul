import { GitHubRepository, RepositoryAnalysis, RankedRepository, SearchIntent } from '../types';
import { EmbeddingResult } from '../types';

/**
 * Hybrid ranking weights — configurable, documented defaults.
 *
 * Final Score =
 *   0.35 × Semantic Similarity        (how well it matches the query)
 *   0.30 × Abandonment Score          (how abandoned it actually is)
 *   0.25 × Revival Potential          (how worthwhile to revive)
 *   0.10 × Technical Opportunity      (dependency/security debt = opportunity)
 *
 * All inputs normalised to 0–100 before weighting.
 */
export interface RankingWeights {
  semanticSimilarity: number;  // default 0.35
  abandonmentScore: number;    // default 0.30
  revivalPotential: number;    // default 0.25
  technicalOpportunity: number; // default 0.10
}

export const DEFAULT_WEIGHTS: RankingWeights = {
  semanticSimilarity: 0.35,
  abandonmentScore: 0.30,
  revivalPotential: 0.25,
  technicalOpportunity: 0.10,
};

export class RepositoryRanker {
  constructor(private readonly weights: RankingWeights = DEFAULT_WEIGHTS) {
    const total = Object.values(weights).reduce((s, v) => s + v, 0);
    if (Math.abs(total - 1.0) > 0.01) {
      throw new Error(`Ranking weights must sum to 1.0, got ${total.toFixed(3)}`);
    }
  }

  /**
   * Rank a list of repositories against a query embedding.
   * Repositories without analysis are ranked lower.
   */
  rank(
    candidates: GitHubRepository[],
    analyses: Map<string, RepositoryAnalysis>,
    queryEmbedding: EmbeddingResult,
    repoEmbeddings: Map<string, EmbeddingResult>,
    intent: SearchIntent,
  ): RankedRepository[] {
    const scored = candidates.map(repo => {
      const analysis = analyses.get(repo.full_name) ?? null;
      const repoEmb = repoEmbeddings.get(repo.full_name);

      // Semantic score (0–1 → 0–100)
      let semanticScore = 0.5; // neutral default when embedding unavailable
      if (repoEmb) {
        const sim = this.cosineSimilarity(queryEmbedding.vector, repoEmb.vector);
        semanticScore = sim; // already 0–1
      }

      // Abandonment score (higher = more abandoned = better for REPOSOUL purposes)
      const abandonmentNorm = analysis ? analysis.abandonmentScore / 100 : 0.5;

      // Revival potential (higher = more worth reviving)
      const revivalNorm = analysis ? analysis.revivalPotential / 100 : 0.5;

      // Technical opportunity (outdated deps, security issues)
      const technicalOpportunityNorm = analysis
        ? this.computeTechnicalOpportunity(analysis)
        : 0.5;

      const hybridRaw =
        this.weights.semanticSimilarity    * semanticScore        +
        this.weights.abandonmentScore      * abandonmentNorm      +
        this.weights.revivalPotential      * revivalNorm          +
        this.weights.technicalOpportunity  * technicalOpportunityNorm;

      const hybridScore = Math.round(Math.min(100, hybridRaw * 100));

      return {
        repository: repo,
        analysis,
        semanticScore,
        hybridScore,
        matchReason: this.buildMatchReason(repo, analysis, semanticScore, intent),
        technicalProblems: this.detectTechnicalProblems(analysis),
        rank: 0, // assigned below
      };
    });

    // Sort descending by hybrid score
    scored.sort((a, b) => b.hybridScore - a.hybridScore);

    // Assign rank positions
    return scored.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  // ─── Score components ──────────────────────────────────────────────────────

  private computeTechnicalOpportunity(analysis: RepositoryAnalysis): number {
    let score = 0;
    const dep = analysis.dependencyAnalysis;
    if (dep) {
      if (dep.criticalVulnerabilities > 0) score += 0.4;
      else if (dep.vulnerableDependencies > 0) score += 0.2;
      if (dep.outdatedDependencies > 10) score += 0.3;
      else if (dep.outdatedDependencies > 3) score += 0.1;
    }
    // Complexity = refactor opportunity
    if (analysis.technicalComplexity === 'high') score += 0.3;
    return Math.min(1, score);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : Math.max(0, Math.min(1, dot / denom));
  }

  // ─── Match explanation ─────────────────────────────────────────────────────

  private buildMatchReason(
    repo: GitHubRepository,
    analysis: RepositoryAnalysis | null,
    semanticScore: number,
    intent: SearchIntent,
  ): string {
    const parts: string[] = [];

    if (semanticScore > 0.7) {
      parts.push('Strong semantic match to your query');
    } else if (semanticScore > 0.5) {
      parts.push('Moderate match to your query');
    } else {
      parts.push('Partial keyword match');
    }

    if (analysis) {
      if (analysis.abandonmentScore >= 70) parts.push(`abandoned for ~${Math.round(analysis.lastCommitAge / 365 * 10) / 10} years`);
      if (analysis.revivalPotential >= 60) parts.push(`high revival potential (${analysis.revivalPotential}%)`);
      if (analysis.communityEngagement >= 50) parts.push('active community history');
    }

    if (repo.stargazers_count >= 1000) parts.push(`${(repo.stargazers_count / 1000).toFixed(1)}k stars`);
    if (repo.language) parts.push(`written in ${repo.language}`);

    return parts.join(', ') + '.';
  }

  private detectTechnicalProblems(analysis: RepositoryAnalysis | null): string[] {
    if (!analysis) return [];
    const problems: string[] = [];
    const dep = analysis.dependencyAnalysis;
    if (dep) {
      if (dep.criticalVulnerabilities > 0) problems.push(`${dep.criticalVulnerabilities} critical vulnerabilities`);
      if (dep.outdatedDependencies > 0) problems.push(`${dep.outdatedDependencies} outdated dependencies`);
    }
    if (analysis.lastCommitAge > 365) problems.push(`no commits in ${Math.round(analysis.lastCommitAge / 365 * 10) / 10}y`);
    if (analysis.issueResponseTime > 60) problems.push('slow issue response');
    if (analysis.technicalComplexity === 'high') problems.push('high technical complexity');
    return problems;
  }
}
