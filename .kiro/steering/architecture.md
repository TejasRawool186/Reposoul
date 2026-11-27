# Architecture — REPOSOUL

## Existing architecture (Phase 2)

REPOSOUL is a compiled TypeScript CLI (`tsc` → `dist/`, CommonJS). Entry points:

- `src/cli.ts` — Commander-based CLI (bin: `reposoul`)
- `src/index.ts` — library exports
- `src/reposoul.ts` — `ReposoulHunter` orchestrator wiring search → analysis → ML

### Modules

| Module | Responsibility |
|---|---|
| `services/github.ts` | GitHub REST client (axios): search, repo, issues, commits, rate limit, org/user/repos; PAT/OAuth auth with auto-detection |
| `services/analyzer.ts` | Rule-based abandonment/revival/community/market scoring |
| `services/dependency-analyzer.ts` | npm dependency health + multi-language dispatch |
| `services/multi-language-analyzer.ts` | Language detection, per-language analysis routing |
| `services/language-analyzers/*` | python (PyPI/OSV), rust (crates.io/RustSec), go (proxy), java (Maven) |
| `services/fork-analyzer.ts` | Fork activity/divergence/responsiveness |
| `services/ml-trainer.ts` | Feature extraction, linear/logistic regression training, model persistence to `data/` |
| `services/ml-predictor.ts` | Model loading, prediction, blending with rule-based scores |
| `services/organization-scanner.ts` | Org/user scans, tech-debt cost/time/security/business metrics |
| `types/index.ts` | Canonical shared interfaces + REPOSOUL brand tokens (single source of truth — do NOT duplicate in services) |

### Phase 4 architecture (web dashboard)

The dashboard lives in `web/` as a Next.js 14 App Router application. It calls three API
routes that dynamically import the existing `src/` services at runtime:

```
web/
├── app/
│   ├── layout.tsx                 Root layout — dark theme, Header, TokenProvider
│   ├── page.tsx                   Home / Discover — search form + results grid
│   ├── investigate/[owner]/[repo] Repository analysis detail view
│   ├── blueprint/[owner]/[repo]   Blueprint viewer — risk register, action checklist
│   ├── api/search/route.ts        → GitHubService.searchRepositories
│   ├── api/analyze/route.ts       → ReposoulHunter.analyzeRepository
│   └── api/blueprint/route.ts    → ReposoulHunter.generateBlueprint
├── components/
│   ├── Header.tsx                 Sticky header with token management
│   ├── RepoCard.tsx               Repository card for search results
│   └── ui/                        ScoreRing, Badge, Card, Button, Input, Spinner
└── lib/
    ├── token-context.tsx          React context — GitHub token in sessionStorage only
    └── api.ts                     Client-side fetch wrappers for the API routes
```

**Phase 4 decisions:**
10. **`web/` is self-contained** — separate `package.json`, its own `node_modules`, does not share the root lockfile.
11. **Dynamic imports in API routes** — `src/` services are imported at request time using `path.resolve(__dirname, '../src')`, keeping the web bundle clean.
12. **Token stays client-side** — GitHub tokens live in `sessionStorage` only, passed as `x-github-token` request header, never logged or persisted server-side.
13. **Design tokens** — `web/tailwind.config.ts` extends the REPOSOUL palette from `assets/theme-tokens.json` so the dashboard and CLI share the same visual identity.

| Module | Responsibility |
|---|---|
| `services/blueprint-generator.ts` | `BlueprintGenerator` — derives RevivalBlueprint from RepositoryAnalysis + optional DependencyAnalysis + ForkComparison. Pure transformation, no I/O. |
| `services/blueprint-formatter.ts` | `BlueprintFormatter` — formats RevivalBlueprint as json/markdown/text/report |

### Phase 3 data flow addition

```
reposoul blueprint <repo>
  └─ ReposoulHunter.generateBlueprint()
       ├─ analyzeRepository()      — existing pipeline
       ├─ [optional] DependencyAnalyzer.analyzeDependencies()
       ├─ [optional] ForkAnalyzer.analyzeForks()
       └─ BlueprintGenerator.generate()
            └─ BlueprintFormatter.format()  → stdout / file
```

### Phase 3 architecture decisions

6. **BlueprintGenerator is pure** — no network calls, no file I/O, no side effects. Fully testable with fixtures alone.
7. **Dynamic imports in CLI** — `BlueprintGenerator` and `BlueprintFormatter` are imported dynamically in `cli.ts` to keep startup time fast for existing commands.
8. **RevivalBlueprint types in `src/types/index.ts`** — `Severity`, `EffortEstimate`, `RiskItem`, `ActionItem`, `DependencyUpgrade`, `BlueprintSection`, `RevivalBlueprint`, `BlueprintOptions` follow the canonical types rule.
9. **`reposoul report` saves to file by default** — outputs `<owner-repo>-report.md` to the current directory to avoid polluting stdout with large Markdown.

### Phase 2 architecture decisions

1. **Canonical types in `src/types/index.ts`** — `TrainingDataPoint`, `MLModel`, `MLPrediction`, `PredictionConfig`, `EnhancedRepositoryAnalysis` live here only. Services re-export from `../types` via `export type {}`.
2. **No `.api` bypass** — `OrganizationScanner` uses `GitHubService` public methods (`getOrganization`, `getUser`, `getOrganizationRepos`, `getUserPublicRepos`) — no direct axios instance access.
3. **`prebuild` cleans `dist/`** — prevents stale compiled artifacts.
4. **`engines` field enforces Node ≥18** — required for global `fetch` used in fork-analyzer and ml-trainer.
5. **`getSocialSignals` returns zeros** — previously returned `Math.random()`, which made training non-deterministic. Fixed with a prominent comment explaining the limitation.

## Constraints

- No external ML service — models are in-process linear/logistic regression persisted as JSON
- Node 18+ (uses global `fetch` in fork analyzer and ml-trainer; enforced via `engines`)
- Rate-limit-aware: delays between batches; token strongly recommended
- Two HTTP client stacks exist (axios + global fetch) — do not add a third; unify in Phase 3

## Testing

- **Vitest 3.x** — `forks` pool, 10s timeout, globals enabled
- Tests live in `tests/unit/services/` and `tests/unit/analyzers/`
- **All external API calls must be mocked** — no real network calls in unit tests
- Current baseline: 88 tests, lines 33.76%, branches 61.76%, functions 56.49%
- Coverage thresholds: lines/stmts 30%, functions 40%, branches 30%

### Phase 5 architecture (Kiro IDE MCP integration)

```
src/mcp/
├── server.ts     MCP stdio server — JSON-RPC 2.0 over stdin/stdout
├── tools.ts      Tool definitions advertised on initialize
└── handlers.ts   McpHandlers class — dispatches tool calls to existing services
```

**Five MCP tools exposed to Kiro:**

| Tool | Description |
|---|---|
| `search_repositories` | Search GitHub for abandoned repositories |
| `analyze_repository` | Full analysis — scores, recommendations |
| `generate_blueprint` | Revival blueprint (json/markdown/text) |
| `analyze_forks` | Fork ecosystem comparison |
| `get_rate_limit` | GitHub API quota check |

**Phase 5 decisions:**
14. **stdio transport** — no HTTP server, no ports. Kiro spawns the process and communicates over stdin/stdout (JSON-RPC lines).
15. **McpHandlers wraps existing services** — no code duplication. The MCP server is a thin protocol adapter over the same `ReposoulHunter` and `GitHubService` already used by the CLI.
16. **Token from environment** — `GITHUB_TOKEN` or `GITHUB_OAUTH_TOKEN` loaded at server startup from `.env`; passed as `${env:GITHUB_TOKEN}` in `.kiro/settings/mcp.json`.
17. **New CLI commands** — `reposoul workspace` generates a Kiro-ready workspace scaffold; `reposoul validate` checks minimum revival standards.

**Two new CLI commands (Phase 5):**
- `reposoul workspace <owner/repo>` — generates `WORKSPACE.md`, `blueprint.md`, `blueprint.json`
- `reposoul validate <owner/repo>` — runs 5 revival-readiness checks

**Kiro configuration** — `.kiro/settings/mcp.json` wires the server:
```json
{
  "mcpServers": {
    "reposoul": {
      "command": "node",
      "args": ["dist/mcp/server.js"],
      "env": { "GITHUB_TOKEN": "${env:GITHUB_TOKEN}" }
    }
  }
}
```



## Boundary between REPOSOUL and Kiro IDE

- REPOSOUL owns: discovery, investigation, scoring, blueprint generation
- Kiro IDE owns: execution of the revival — specs, tasks, agent-assisted coding,
  validation runs
- The handoff artifact is the **blueprint** (Phase 3+). REPOSOUL must not embed or
  depend on Kiro internals; integration happens through open formats (blueprint files,
  and later an MCP server, which is explicitly out of scope until Phase 5)
- No Kiro-specific code may be added before Phase 5 without a design review
