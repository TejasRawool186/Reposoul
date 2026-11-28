export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    type: string;
  };
  description: string | null;
  html_url: string;
  clone_url: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  topics: string[];
  archived: boolean;
  disabled: boolean;
  license: {
    key: string;
    name: string;
  } | null;
}

export interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepository[];
}

export interface RepositoryAnalysis {
  repository: GitHubRepository;
  abandonmentScore: number;
  revivalPotential: number;
  lastCommitAge: number; // days
  issueResponseTime: number; // average days
  dependencyHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'unknown';
  dependencyAnalysis?: DependencyAnalysis;
  communityEngagement: number; // 0-100
  technicalComplexity: 'low' | 'medium' | 'high';
  marketRelevance: number; // 0-100
  reasons: string[];
  recommendations: string[];
}

export interface SearchFilters {
  language?: string;
  category?: ProjectCategory;
  minStars?: number;
  maxStars?: number;
  pushedBefore?: string; // ISO date
  pushedAfter?: string; // ISO date
  hasIssues?: boolean;
  archived?: boolean;
  includePrivate?: boolean; // Include private repositories (requires appropriate token scope)
  sort?: 'stars' | 'updated' | 'created';
  order?: 'asc' | 'desc';
}

export type ProjectCategory = 
  | 'cli-tool'
  | 'build-tool' 
  | 'dev-tool'
  | 'testing'
  | 'linter'
  | 'framework'
  | 'library'
  | 'plugin';

export interface HuntResults {
  query: string;
  filters: SearchFilters;
  totalFound: number;
  analyzed: RepositoryAnalysis[];
  executionTime: number;
  timestamp: string;
}

// Dependency analysis types
export interface DependencyInfo {
  name: string;
  currentVersion: string;
  latestVersion?: string;
  isOutdated: boolean;
  vulnerabilities: Vulnerability[];
  securityScore: number; // 0-100
  type: 'dependency' | 'devDependency' | 'peerDependency';
}

export interface Vulnerability {
  severity: 'low' | 'moderate' | 'high' | 'critical';
  title: string;
  description: string;
  patchedVersions?: string;
  vulnerableVersions: string;
  source: 'npm' | 'github' | 'snyk';
}

export interface DependencyAnalysis {
  totalDependencies: number;
  outdatedDependencies: number;
  vulnerableDependencies: number;
  criticalVulnerabilities: number;
  dependencyHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'unknown';
  healthScore: number; // 0-100
  dependencies: DependencyInfo[];
  recommendations: string[];
  lastUpdated?: Date;
}

// Fork analysis types
export interface ForkInfo {
  repository: GitHubRepository;
  analysis: RepositoryAnalysis;
  activityScore: number; // 0-100
  divergenceFromOriginal: number; // commits ahead
  lastActivityDays: number;
  hasRecentCommits: boolean;
  hasRecentReleases: boolean;
  maintainerResponsiveness: number; // 0-100
  forkRank: number; // 1-based ranking
}

export interface ForkComparison {
  original: GitHubRepository;
  totalForks: number;
  analyzedForks: number;
  activeForks: ForkInfo[];
  topRecommendations: ForkInfo[];
  insights: string[];
  bestForRevival?: ForkInfo;
  bestForContribution?: ForkInfo;
  mostDiverged?: ForkInfo;
  executionTime: number;
  timestamp: string;
}

export interface ForkAnalysisOptions {
  maxForks?: number; // Maximum forks to analyze (default: 20)
  minStars?: number; // Minimum stars to consider (default: 1)
  minActivity?: number; // Minimum days since last activity (default: 365)
  includeOriginal?: boolean; // Include original repo in comparison (default: true)
  sortBy?: 'activity' | 'stars' | 'divergence' | 'health';
}

// ML-related types
export interface MLPrediction {
  abandonment_probability: number; // 0-1
  revival_success_probability: number; // 0-1
  estimated_effort_days: number;
  community_adoption_likelihood: number; // 0-1
  confidence_score: number; // 0-1
  key_factors: string[];
  recommendations: string[];
}

export interface EnhancedRepositoryAnalysis extends RepositoryAnalysis {
  mlPrediction?: MLPrediction;
  mlConfidence?: number;
  scoringMethod: 'rule-based' | 'ml-enhanced' | 'hybrid';
  predictionFactors?: string[];
}

export interface PredictionConfig {
  useMLScoring: boolean;
  confidenceThreshold: number; // 0-1, minimum confidence to use ML predictions
  fallbackToRuleBase: boolean; // Use rule-based scoring if ML confidence is low
  modelVersion?: string;
}

export interface TrainingDataPoint {
  features: {
    // Basic metrics
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    size: number;
    watchers_count: number;
    
    // Time-based features
    age_days: number;
    days_since_last_commit: number;
    days_since_last_release: number;
    
    // Activity patterns
    commits_last_30_days: number;
    commits_last_90_days: number;
    commits_last_365_days: number;
    issues_opened_last_30_days: number;
    issues_closed_last_30_days: number;
    
    // Community metrics
    contributor_count: number;
    unique_contributors_last_year: number;
    issue_response_time_avg: number;
    pr_merge_rate: number;
    
    // Technical indicators
    has_tests: boolean;
    has_ci: boolean;
    has_documentation: boolean;
    has_license: boolean;
    has_contributing_guide: boolean;
    
    // Language and ecosystem
    language_popularity_score: number;
    ecosystem_health_score: number;
    
    // Dependency health
    dependency_count: number;
    outdated_dependency_ratio: number;
    vulnerable_dependency_count: number;
    critical_vulnerability_count: number;
    
    // Social signals
    mentioned_in_awesome_lists: boolean;
    stackoverflow_mentions: number;
    reddit_mentions: number;
    blog_post_mentions: number;
  };
  
  labels: {
    is_abandoned: boolean;
    revival_success_probability: number; // 0-1
    estimated_revival_effort_days: number;
    community_adoption_likelihood: number; // 0-1
  };
  
  repository: GitHubRepository;
  analysis_date: string;
  revival_outcome?: 'successful' | 'failed' | 'ongoing' | 'unknown';
}

export interface MLModel {
  type: 'abandonment' | 'revival_success' | 'effort_estimation' | 'community_adoption';
  algorithm: 'linear_regression' | 'random_forest' | 'neural_network' | 'gradient_boosting';
  accuracy: number;
  features: string[];
  weights?: number[];
  model_data: any;
  trained_at: string;
  training_samples: number;
}

export interface ReposoulConfig {
  githubToken?: string;
  defaultFilters: SearchFilters;
  outputFormat: 'json' | 'table' | 'markdown';
  maxResults: number;
  analysisDepth: 'basic' | 'detailed' | 'comprehensive';
  dependencyAnalysis?: boolean;
  forkAnalysis?: boolean;
  mlEnhanced?: boolean;
  mlConfig?: PredictionConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// REPOSOUL Visual Brand Tokens
// Design direction: dark-first, phoenix-inspired, ember accents
// ─────────────────────────────────────────────────────────────────────────────

export const REPOSOUL_BRAND = {
  name: 'REPOSOUL',
  tagline: 'Give abandoned software a second life.',
  version: '1.0.0',
  category: 'Open Source Resurrection Workbench',
} as const;

export const REPOSOUL_COLORS = {
  // Surfaces
  background:      '#090909',
  surface:         '#111111',
  surfaceElevated: '#191919',

  // Accents (phoenix / ember palette)
  primary:         '#F97316',   // warm orange
  secondary:       '#FB923C',   // lighter ember

  // Text
  textPrimary:     '#F5F5F5',
  textSecondary:   '#A1A1AA',

  // Status
  success:         '#22C55E',
  warning:         '#EAB308',
  error:           '#EF4444',
} as const;

// Terminal chalk-compatible hex palette alias (no actual chalk dep here)
export const REPOSOUL_TERMINAL = {
  brand:    REPOSOUL_COLORS.primary,      // '#F97316' — use chalk.hex(brand)
  dim:      REPOSOUL_COLORS.textSecondary,
  success:  REPOSOUL_COLORS.success,
  warning:  REPOSOUL_COLORS.warning,
  error:    REPOSOUL_COLORS.error,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — Revival Blueprint Types
// ─────────────────────────────────────────────────────────────────────────────

/** Severity classification for risks and issues */
export type Severity = 'critical' | 'high' | 'medium' | 'low';

/** Effort estimation for a revival task */
export interface EffortEstimate {
  /** Minimum working days */
  minDays: number;
  /** Maximum working days */
  maxDays: number;
  /** Recommended team size */
  teamSize: number;
  /** Complexity rating */
  complexity: 'trivial' | 'low' | 'medium' | 'high' | 'very-high';
  /** Key factors driving the estimate */
  factors: string[];
}

/** A single identified risk in the revival plan */
export interface RiskItem {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  probability: 'low' | 'medium' | 'high';
  impact: string;
  mitigation: string;
  category: 'technical' | 'dependency' | 'community' | 'legal' | 'operational';
}

/** A concrete action item with priority and owner suggestion */
export interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: 1 | 2 | 3 | 4 | 5; // 1 = highest
  phase: 'immediate' | 'short-term' | 'medium-term' | 'long-term';
  effort: 'hours' | 'days' | 'weeks';
  category: 'dependency' | 'testing' | 'documentation' | 'ci-cd' | 'security' | 'refactor' | 'community';
  done: boolean;
}

/** Dependency upgrade recommendation */
export interface DependencyUpgrade {
  name: string;
  currentVersion: string;
  targetVersion: string;
  reason: 'security' | 'outdated' | 'deprecated' | 'breaking-change';
  breaking: boolean;
  priority: Severity;
  notes?: string;
}

/** A named section of the blueprint */
export interface BlueprintSection {
  id: string;
  title: string;
  content: string;
}

/** The complete revival blueprint for a repository */
export interface RevivalBlueprint {
  // Identity
  repository: string; // owner/name
  generatedAt: string; // ISO timestamp
  version: '1.0';

  // Summary
  recommendation: 'revive' | 'fork' | 'archive' | 'monitor';
  recommendationReason: string;
  overallScore: number; // 0-100 composite
  confidence: 'high' | 'medium' | 'low';

  // Scores from analysis
  scores: {
    abandonment: number;
    revivalPotential: number;
    communityEngagement: number;
    dependencyHealth: number;
    technicalComplexity: string;
  };

  // Effort
  effortEstimate: EffortEstimate;

  // Plan
  riskRegister: RiskItem[];
  actionItems: ActionItem[];
  dependencyUpgrades: DependencyUpgrade[];

  // Narrative sections
  executiveSummary: string;
  technicalAssessment: string;
  communityAssessment: string;
  revivalStrategy: string;

  // Metadata
  sections: BlueprintSection[];
  tags: string[];
}

/** Options passed to BlueprintGenerator */
export interface BlueprintOptions {
  /** Include fork ecosystem analysis */
  includeForks?: boolean;
  /** Include ML predictions if available */
  mlEnhanced?: boolean;
  /** Maximum number of action items to include */
  maxActionItems?: number;
  /** Maximum number of risks to include */
  maxRisks?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5 — MCP (Model Context Protocol) Types
// ─────────────────────────────────────────────────────────────────────────────

/** JSON Schema primitive types used in MCP input schemas */
export type JsonSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';

/** A single property definition within an MCP tool's input schema */
export interface McpPropertySchema {
  type: JsonSchemaType;
  description: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  items?: { type: JsonSchemaType };
  enum?: string[];
}

/** JSON Schema object describing a tool's accepted parameters */
export interface McpInputSchema {
  type: 'object';
  properties: Record<string, McpPropertySchema>;
  required?: string[];
}

/** An MCP tool definition — advertised to the host (Kiro) on initialize */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: McpInputSchema;
}

/** MCP JSON-RPC request */
export interface McpRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/** MCP JSON-RPC success response */
export interface McpResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: unknown;
}

/** MCP JSON-RPC error response */
export interface McpErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/** Standard MCP error codes */
export const MCP_ERROR = {
  PARSE_ERROR:      -32700,
  INVALID_REQUEST:  -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS:   -32602,
  INTERNAL_ERROR:   -32603,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 — AI Semantic Discovery Types
// ─────────────────────────────────────────────────────────────────────────────

/** Structured search intent derived from a natural-language query */
export interface SearchIntent {
  /** Original user query preserved for display */
  originalQuery: string;
  /** Keywords extracted for GitHub search */
  keywords: string[];
  /** Programming languages to filter by */
  languages: string[];
  /** Technical/problem domains */
  domains: string[];
  /** Minimum star count (null = no constraint) */
  minimumStars: number | null;
  /** Maximum star count (null = no constraint) */
  maximumStars: number | null;
  /** Abandonment preference */
  abandonmentPreference: 'any' | 'likely_abandoned' | 'definitely_abandoned';
  /** Technical issues the user wants to find */
  technicalIssues: Array<'outdated_dependencies' | 'no_tests' | 'no_ci' | 'security_vulnerabilities' | 'no_documentation'>;
  /** Preferred sort for results */
  sortPreference: 'revival_potential' | 'stars' | 'recent_activity' | 'semantic_relevance';
  /** Date before which the repo should have been last pushed (ISO date string) */
  pushedBefore: string | null;
  /** Confidence that the query was understood correctly (0–1) */
  confidence: number;
}

/** A repository candidate with semantic ranking metadata */
export interface RankedRepository {
  repository: GitHubRepository;
  analysis: RepositoryAnalysis | null;
  /** Semantic similarity to the query embedding (0–1) */
  semanticScore: number;
  /** Overall hybrid rank score (0–100) */
  hybridScore: number;
  /** Short explanation of why this repository matches */
  matchReason: string;
  /** Identified technical problems */
  technicalProblems: string[];
  /** Rank position in results */
  rank: number;
}

/** Result of a semantic discovery search */
export interface SemanticSearchResult {
  intent: SearchIntent;
  results: RankedRepository[];
  totalCandidates: number;
  executionTimeMs: number;
  timestamp: string;
  aiProvider: string;
  embeddingModel: string;
}

/** Embedding vector with metadata */
export interface EmbeddingResult {
  vector: number[];
  model: string;
  dimensions: number;
  inputText: string;
}

/** AI provider configuration */
export interface AIProviderConfig {
  groqApiKey?: string;
  groqModel?: string;
  embeddingModel?: string;
  maxTokens?: number;
  temperature?: number;
}

// ─── Workspace types (Phase 2) ─────────────────────────────────────────────────

/** Progress callback for long-running workspace operations */
export type WorkspaceProgressCallback = (
  message: string,
  detail?: string
) => void;

/** Result of a workspace clone operation */
export interface WorkspaceCloneResult {
  success: boolean;
  path: string | null;
  sizeBytes: number | null;
  totalFiles: number | null;
  defaultBranch: string | null;
  headCommit: string | null;
  error: string | null;
}

/** Result of a workspace preparation operation */
export interface WorkspaceResult {
  repository: string;
  workspacePath: string;
  blueprintPath: string;
  blueprintJsonPath: string;
  cloned: WorkspaceCloneResult | null;
  filesWritten: string[];
  durationMs: number;
}

/** Summary info about a prepared workspace */
export interface WorkspaceInfo {
  repository: string;
  workspacePath: string;
  createdAt: string;
  defaultBranch: string | null;
  headCommit: string | null;
  hasBlueprint: boolean;
  hasClone: boolean;
}

// ─── Workspace Registry types (Phase 3) ───────────────────────────────────────

/** Status of a registered workspace */
export type WorkspaceStatus = 'ready' | 'cloning' | 'error' | 'missing';

/** A workspace entry stored in the registry */
export interface WorkspaceEntry {
  /** UUID assigned at creation */
  id: string;
  /** owner/repo */
  repository: string;
  /** Absolute path to the workspace directory */
  workspacePath: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last access */
  lastAccessedAt: string;
  /** Current status */
  status: WorkspaceStatus;
  /** Short human-readable note (e.g. clone error message) */
  statusNote: string | null;
  /** True when repo/ subdir exists and was cloned successfully */
  hasClone: boolean;
  /** True when blueprint.md exists */
  hasBlueprint: boolean;
  /** Default branch from clone metadata */
  defaultBranch: string | null;
  /** HEAD commit hash (short) */
  headCommit: string | null;
  /** Tags applied by the user */
  tags: string[];
}

/** Payload for creating a new workspace entry */
export interface CreateWorkspacePayload {
  repository: string;
  workspacePath: string;
  hasClone?: boolean;
  hasBlueprint?: boolean;
  defaultBranch?: string | null;
  headCommit?: string | null;
  tags?: string[];
  statusNote?: string | null;
}

/** Result of a Kiro/editor open attempt */
export interface LaunchResult {
  success: boolean;
  editor: string | null;
  editorPath: string | null;
  workspacePath: string;
  error: string | null;
}

/** Detected editor installation */
export interface EditorInstallation {
  name: string;
  command: string;
  path: string | null;
  isKiro: boolean;
}

// ─── Live Monitoring types (Phase 4) ──────────────────────────────────────────

/** Categories of workspace filesystem events */
export type WorkspaceEventType =
  | 'file_added'
  | 'file_changed'
  | 'file_deleted'
  | 'file_renamed'
  | 'git_commit'
  | 'git_branch_changed'
  | 'monitor_started'
  | 'monitor_stopped'
  | 'error';

/** A single workspace event emitted by the monitor */
export interface WorkspaceEvent {
  id: string;
  workspaceId: string;
  type: WorkspaceEventType;
  /** Relative path inside the workspace (undefined for git/meta events) */
  path?: string;
  /** Additional context (commit hash, branch name, error message, etc.) */
  detail?: string;
  timestamp: string;
}

/** Point-in-time status snapshot of a monitored workspace */
export interface WorkspaceStatusSnapshot {
  workspaceId: string;
  workspacePath: string;
  repoPath: string | null;
  /** True when the repo/ subdirectory exists and is a git repo */
  hasRepo: boolean;
  /** Current branch name, or null */
  currentBranch: string | null;
  /** HEAD commit hash (full), or null */
  headCommit: string | null;
  /** Number of uncommitted changes (modified + untracked) */
  pendingChanges: number;
  /** Short summary lines from git status --short */
  statusLines: string[];
  /** ISO timestamp of this snapshot */
  capturedAt: string;
}

/** A single changed-file entry in a diff */
export interface DiffEntry {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  /** Unified diff text, present when available */
  patch?: string;
}

/** Result of a workspace diff operation */
export interface WorkspaceDiff {
  workspaceId: string;
  repoPath: string | null;
  entries: DiffEntry[];
  totalChanges: number;
  capturedAt: string;
}

/** Options for WorkspaceMonitorService */
export interface MonitorOptions {
  /** Glob patterns to ignore (default: node_modules, .git internals, dist, etc.) */
  ignored?: string[];
  /** Debounce delay in ms before emitting a batch of events (default: 300) */
  debounceMs?: number;
  /** Whether to report initial file scan as events (default: false) */
  ignoreInitial?: boolean;
}
