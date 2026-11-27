import { GitHubAuthConfig, GitHubService } from '../services/github';
import { ReposoulHunter } from '../reposoul';
import { ForkAnalyzer } from '../services/fork-analyzer';
import { BlueprintFormatter } from '../services/blueprint-formatter';
import { SearchFilters } from '../types';

/**
 * MCP tool handlers — each function maps to a tool name in tools.ts.
 *
 * All handlers receive a pre-constructed auth config so the server can
 * inject the GitHub token from the environment once at startup.
 */
export class McpHandlers {
  private hunter: ReposoulHunter;
  private github: GitHubService;

  constructor(auth: GitHubAuthConfig = {}) {
    this.hunter = new ReposoulHunter(auth);
    this.github = this.hunter.githubService;
  }

  /**
   * search_repositories — wraps GitHubService.searchRepositories
   */
  async searchRepositories(params: Record<string, unknown>): Promise<unknown> {
    const filters: SearchFilters = {
      language:     typeof params.language === 'string'     ? params.language : undefined,
      minStars:     typeof params.minStars === 'number'     ? params.minStars : undefined,
      maxStars:     typeof params.maxStars === 'number'     ? params.maxStars : undefined,
      pushedBefore: typeof params.pushedBefore === 'string' ? params.pushedBefore : undefined,
      pushedAfter:  typeof params.pushedAfter === 'string'  ? params.pushedAfter : undefined,
    };

    const perPage = typeof params.limit === 'number'
      ? Math.max(1, Math.min(30, params.limit))
      : 10;

    const response = await this.github.searchRepositories(filters, 1, perPage);
    return {
      total_count: response.total_count,
      repositories: response.items.map(r => ({
        full_name:        r.full_name,
        description:      r.description,
        language:         r.language,
        stargazers_count: r.stargazers_count,
        forks_count:      r.forks_count,
        pushed_at:        r.pushed_at,
        archived:         r.archived,
        license:          r.license?.name ?? null,
        url:              r.html_url,
      })),
    };
  }

  /**
   * analyze_repository — wraps ReposoulHunter.analyzeRepository
   */
  async analyzeRepository(params: Record<string, unknown>): Promise<unknown> {
    const repo = params.repository;
    if (typeof repo !== 'string' || !repo.includes('/')) {
      throw new Error('repository must be in owner/name format');
    }

    const mlEnhanced = params.mlEnhanced === true;
    const mlConfig = {
      useMLScoring: mlEnhanced,
      confidenceThreshold: 0.7,
      fallbackToRuleBase: true,
    };

    const analysis = await this.hunter.analyzeRepository(repo, mlEnhanced, mlConfig);
    return analysis;
  }

  /**
   * generate_blueprint — wraps ReposoulHunter.generateBlueprint
   */
  async generateBlueprint(params: Record<string, unknown>): Promise<unknown> {
    const repo = params.repository;
    if (typeof repo !== 'string' || !repo.includes('/')) {
      throw new Error('repository must be in owner/name format');
    }

    const mlEnhanced = params.mlEnhanced === true;
    const format = (params.format as 'json' | 'markdown' | 'text') || 'json';

    const blueprint = await this.hunter.generateBlueprint(repo, { mlEnhanced });

    if (format === 'json') {
      return blueprint;
    }

    // For markdown/text, return the formatted string
    const formatter = new BlueprintFormatter();
    return { formatted: formatter.format(blueprint, format), blueprint };
  }

  /**
   * analyze_forks — wraps ForkAnalyzer.analyzeForks
   */
  async analyzeForks(params: Record<string, unknown>): Promise<unknown> {
    const repo = params.repository;
    if (typeof repo !== 'string' || !repo.includes('/')) {
      throw new Error('repository must be in owner/name format');
    }

    const [owner, name] = repo.split('/');
    const maxForks = typeof params.maxForks === 'number'
      ? Math.max(1, Math.min(50, params.maxForks))
      : 15;

    const analyzer = new ForkAnalyzer(this.github);
    const result = await analyzer.analyzeForks(owner, name, { maxForks });
    return result;
  }

  /**
   * get_rate_limit — wraps GitHubService.getRateLimit
   */
  async getRateLimit(_params: Record<string, unknown>): Promise<unknown> {
    const data = await this.github.getRateLimit();
    return {
      limit:     data.rate.limit,
      remaining: data.rate.remaining,
      reset:     new Date(data.rate.reset * 1000).toISOString(),
      used:      data.rate.limit - data.rate.remaining,
    };
  }

  /**
   * Dispatch a tool call by name
   */
  async dispatch(toolName: string, params: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case 'search_repositories': return this.searchRepositories(params);
      case 'analyze_repository':  return this.analyzeRepository(params);
      case 'generate_blueprint':  return this.generateBlueprint(params);
      case 'analyze_forks':       return this.analyzeForks(params);
      case 'get_rate_limit':      return this.getRateLimit(params);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
