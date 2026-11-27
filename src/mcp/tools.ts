import { McpTool } from '../types';

/**
 * All REPOSOUL MCP tool definitions.
 * These are advertised to Kiro IDE on the initialize handshake.
 */
export const REPOSOUL_TOOLS: McpTool[] = [
  {
    name: 'search_repositories',
    description:
      'Search GitHub for abandoned open-source repositories. Returns a list of repositories matching the given filters, ordered by relevance.',
    inputSchema: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          description: 'Primary programming language (e.g. "typescript", "python", "rust")',
        },
        minStars: {
          type: 'integer',
          description: 'Minimum number of GitHub stars',
          default: 50,
          minimum: 0,
        },
        maxStars: {
          type: 'integer',
          description: 'Maximum number of GitHub stars',
          minimum: 0,
        },
        pushedBefore: {
          type: 'string',
          description: 'Only include repositories last pushed before this date (YYYY-MM-DD)',
        },
        pushedAfter: {
          type: 'string',
          description: 'Only include repositories last pushed after this date (YYYY-MM-DD)',
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of results to return (1–30)',
          default: 10,
          minimum: 1,
          maximum: 30,
        },
      },
    },
  },

  {
    name: 'analyze_repository',
    description:
      'Analyze a specific GitHub repository and return abandonment score, revival potential, community engagement, dependency health, and actionable recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        repository: {
          type: 'string',
          description: 'Repository in owner/name format (e.g. "facebook/create-react-app")',
        },
        mlEnhanced: {
          type: 'boolean',
          description: 'Use ML-enhanced scoring if trained models are available',
          default: false,
        },
      },
      required: ['repository'],
    },
  },

  {
    name: 'generate_blueprint',
    description:
      'Generate a structured revival blueprint for a repository. The blueprint includes a recommendation (revive/fork/archive/monitor), effort estimate, risk register, prioritised action items, and dependency upgrade plan.',
    inputSchema: {
      type: 'object',
      properties: {
        repository: {
          type: 'string',
          description: 'Repository in owner/name format (e.g. "owner/repo")',
        },
        mlEnhanced: {
          type: 'boolean',
          description: 'Use ML-enhanced scoring for the blueprint',
          default: false,
        },
        format: {
          type: 'string',
          description: 'Output format: "json" (default), "markdown", or "text"',
          default: 'json',
          enum: ['json', 'markdown', 'text'],
        },
      },
      required: ['repository'],
    },
  },

  {
    name: 'analyze_forks',
    description:
      'Analyze the fork ecosystem of an abandoned repository to identify active forks, divergence from the original, and community continuations worth monitoring.',
    inputSchema: {
      type: 'object',
      properties: {
        repository: {
          type: 'string',
          description: 'Repository in owner/name format',
        },
        maxForks: {
          type: 'integer',
          description: 'Maximum number of forks to analyse',
          default: 15,
          minimum: 1,
          maximum: 50,
        },
      },
      required: ['repository'],
    },
  },

  {
    name: 'get_rate_limit',
    description:
      'Check the current GitHub API rate limit status. Useful before running bulk analysis to ensure sufficient quota remains.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

/** Look up a tool by name */
export function findTool(name: string): McpTool | undefined {
  return REPOSOUL_TOOLS.find(t => t.name === name);
}
