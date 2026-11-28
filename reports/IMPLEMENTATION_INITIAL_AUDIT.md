# REPOSOUL — Implementation Initial Audit

**Date:** 2026-11-28  
**Auditor:** Kiro agent  
**Repository:** https://github.com/TejasRawool186/Reposoul  
**Branch:** main  
**Baseline commit:** fe3fe84

---

## 1. Baseline verification

| Check | Result |
|---|---|
| `npm test` | 186/186 passing (11 test files) |
| `npm run build` | Exit 0 — zero errors |
| `npm run typecheck` | Exit 0 — zero TypeScript errors |
| `npm audit --omit=dev` | 0 production vulnerabilities |
| `cd web && npm run build` | Exit 0 — 7 routes generated |
| Vitest dev-dep CVEs | 7 (all Vitest-internal, dev-only, documented) |

---

## 2. Existing functionality (verified in source code)

### CLI (13 commands — `src/cli.ts`)

| Command | Verified |
|---|---|
| `hunt` | Yes — GitHub search + analysis + ML blend |
| `analyze` | Yes — single repo deep analysis |
| `forks` | Yes — fork ecosystem comparison |
| `blueprint` | Yes — revival blueprint (json/md/text) |
| `report` | Yes — saves `<owner-repo>-report.md` |
| `workspace` | Yes — clones repo, creates 3-file workspace scaffold |
| `validate` | Yes — 5 revival-readiness checks |
| `scan` | Yes — org scan with tech-debt metrics |
| `scan-multi` | Yes — multi-org comparison |
| `train` | Yes — ML model training |
| `ml-info` | Yes — model status display |
| `languages` | Yes — supported language list |
| `rate-limit` | Yes — GitHub quota check |

### Core services (`src/services/`)

| Service | Status |
|---|---|
| `github.ts` — GitHubService | Complete. PAT/OAuth auth, search, repo, issues, commits, rate-limit, org/user/repos |
| `analyzer.ts` — RepositoryAnalyzer | Complete. Rule-based scoring: abandonment, revival, community, market |
| `dependency-analyzer.ts` — DependencyAnalyzer | Complete. npm + 4 language dispatchers. `isVersionVulnerable()` always returns `true` (placeholder) |
| `multi-language-analyzer.ts` | Complete. Language detection + dispatch |
| `language-analyzers/python-analyzer.ts` | Complete (PyPI). Best-effort |
| `language-analyzers/rust-analyzer.ts` | Complete (crates.io). Best-effort |
| `language-analyzers/go-analyzer.ts` | Complete (Go proxy). Best-effort |
| `language-analyzers/java-analyzer.ts` | Complete (Maven). Best-effort |
| `fork-analyzer.ts` — ForkAnalyzer | Complete. Uses global `fetch` (Node 18+) |
| `ml-trainer.ts` — MLTrainer | Complete. Linear/logistic regression, model persistence. `getSocialSignals()` returns zeros (documented) |
| `ml-predictor.ts` — MLPredictor | Complete. Model load, prediction, rule-based fallback |
| `organization-scanner.ts` — OrganizationScanner | Complete. Tech-debt financial metrics |
| `blueprint-generator.ts` — BlueprintGenerator | Complete. Pure transformation, no I/O |
| `blueprint-formatter.ts` — BlueprintFormatter | Complete. JSON / Markdown / text / report |

### MCP server (`src/mcp/`)

| Item | Status |
|---|---|
| `server.ts` — stdio JSON-RPC | Complete. Handles initialize, tools/list, tools/call, ping |
| `tools.ts` — 5 tool definitions | Complete |
| `handlers.ts` — McpHandlers | Complete. Dispatches to existing services |
| `tools: search_repositories` | Complete |
| `tools: analyze_repository` | Complete |
| `tools: generate_blueprint` | Complete |
| `tools: analyze_forks` | Complete |
| `tools: get_rate_limit` | Complete |

### Web dashboard (`web/`)

| Item | Status |
|---|---|
| Home / Discover page | Complete. Form-based search + quick-analyze input |
| URL parsing (`parseRepo`) | Complete. Accepts full GitHub URLs |
| Investigate page | Complete. Score rings, tabs, metrics |
| Blueprint page | Complete. Risk register, action checklist, dep upgrades |
| `/api/search` | Complete (uses `createRequire` from dist/) |
| `/api/analyze` | Complete |
| `/api/blueprint` | Complete |
| Design system | Complete. Badge, Button, Card, Input, ScoreRing, Spinner |
| Header with token management | Complete. sessionStorage only |
| Tailwind dark theme | Complete. Extends theme-tokens.json |

### Kiro integration

| Item | Status |
|---|---|
| `.kiro/settings/mcp.json` | Complete. Points to `dist/mcp/server.js` |
| Steering docs | Complete. 5 documents in `.kiro/steering/` |

---

## 3. Missing functionality (gap analysis)

### Feature A — AI Semantic Discovery
- **Missing entirely.** No NLP/LLM query understanding. No embedding service. No semantic ranking. No AI-powered search UI. The home page has only structured form-based search.
- Required: Groq integration, embedding provider abstraction, hybrid ranking, AI search UI.

### Feature B — GitHub URL Investigation (enhancement)
- **Partially complete.** `parseRepo()` in `api.ts` accepts URLs. The investigate page accepts `owner/repo` params from the router. However: no dedicated "paste a URL" landing UI with explicit validation feedback, no accessibility check, no private-repo detection UX, no "previously investigated" indicator.

### Feature C — Unified Discovery Dashboard
- **Partially complete.** One page exists. Missing: saved repositories panel, search history, pagination, advanced filters, shortlist functionality.

### Feature D — Repository Workspace Manager
- **Minimal placeholder.** The existing `reposoul workspace` CLI command creates 3 files (`WORKSPACE.md`, `blueprint.md`, `blueprint.json`) in a local subdirectory — it does **not** clone the repository. There is no `WorkspaceManager` service, no Git clone, no resurrection branch, no workspace registry, no configurable workspace directory.

### Feature E — Open in Kiro IDE
- **Not implemented.** No Kiro launcher detection, no `open` command, no workspace MCP configuration injection.

### Feature F — Live Workspace Monitoring
- **Not implemented.** No filesystem watcher, no Git diff service, no workspace event service.

### Feature G — Live Dashboard Synchronization
- **Not implemented.** No WebSocket/SSE, no real-time updates, no reconnection handling.

### Feature H — Workspace Monitor UI
- **Not implemented.** No `/workspaces/[id]` page.

### Feature I — MCP Activity Integration
- **Missing new tools.** Existing 5 tools are complete. New tools needed: `list_workspaces`, `get_workspace_status`, `report_task_started/progress/completed/failed`, `report_validation_result`.

### Feature J — Resurrection Task Management
- **Not implemented.** Blueprint action items exist as a data structure but have no task lifecycle (approved/pending/in-progress/completed/failed).

### Feature K — Validation Center
- **Minimal.** `reposoul validate` runs 5 static checks (license, revival score, stars, disabled, description). No actual build/test/lint execution. No project-type detection. No safe subprocess execution framework.

### Feature L — Release & Contribution Management
- **Not implemented.** No contribution report, no PR preparation, no diff review before publish.

### Feature M — Saved Repositories and History
- **Not implemented.** No persistence layer for saved repos, no investigation history.

### Feature N — Dashboard Navigation
- **Minimal.** 3 pages only. No sidebar navigation, no workspace section, no validation center, no history.

### Feature O — Settings and Integrations
- **Not implemented.** Token is stored only in `sessionStorage`. No settings page, no Groq config, no workspace directory config.

---

## 4. Architecture overview

```
d:\kraven\
├── src/                     CLI + services (Node.js, CommonJS)
│   ├── cli.ts               13 commands
│   ├── reposoul.ts          ReposoulHunter orchestrator
│   ├── index.ts             Library exports
│   ├── types/index.ts       All shared TypeScript interfaces
│   ├── services/            10 service files + 4 language analyzers
│   └── mcp/                 stdio JSON-RPC server (3 files)
├── web/                     Next.js 16 dashboard (separate package)
│   ├── app/                 App Router pages + 3 API routes
│   ├── components/          6 UI components + 2 shared
│   └── lib/                 token-context, api.ts, reposoul-server.ts
├── tests/                   11 Vitest test files (186 tests)
├── data/                    ML model weights
├── assets/                  Brand assets + theme tokens
├── .kiro/                   Steering docs + MCP settings
└── reports/                 Phase reports
```

**Key architectural constraint:** `web/` is a separate npm package. API routes load services from the compiled `dist/` using `createRequire` (Turbopack-compatible CommonJS dynamic loading).

---

## 5. Integration points

| Integration | Current state | Required for |
|---|---|---|
| GitHub REST API (axios) | Complete, PAT+OAuth | All features |
| Groq API | Not present | Feature A (AI discovery) |
| Embedding provider | Not present | Feature A (semantic ranking) |
| Git CLI (subprocess) | Not present | Feature D (workspace clone) |
| Chokidar/fs.watch | Not present | Feature F (monitoring) |
| WebSocket / SSE | Not present | Feature G (live sync) |
| Kiro launcher | Not present | Feature E |
| SQLite / JSON persistence | Not present | Features D, M (registry) |

---

## 6. Potential breaking changes

| Risk | Mitigation |
|---|---|
| Adding new npm dependencies | Use `--save-exact`, audit before adding |
| Modifying `src/types/index.ts` | Additive only — do not remove existing interfaces |
| Changing API route signatures | Version new routes under `/api/v2/` if needed |
| `dist/` structure changes | `web/lib/reposoul-server.ts` loads from `dist/` — keep paths stable |
| Changing workspace CLI command | Add new behaviour; preserve existing 3-file scaffold for backward compat |
| `createRequire` loader in web | Do not change until a better pattern is proven in Next.js 16 Turbopack |

---

## 7. Security considerations

| Concern | Current state | Required action |
|---|---|---|
| Path traversal in workspace cloning | Not yet implemented | CRITICAL: validate all paths against workspace root |
| Command injection in Git subprocess | Not yet implemented | Use argument arrays only, never shell strings |
| Secret leakage in diffs | Not yet implemented | Redact `.env` patterns before exposing diff content |
| Token in browser | sessionStorage only | Acceptable; never sent to external services |
| Groq API key | Not yet present | Must go in `.env` only, never in client bundle |
| Workspace registry tamper | Not yet implemented | Validate registry paths on read |
| Local monitoring endpoint auth | Not yet implemented | Require a local shared secret for event delivery |
| Arbitrary script execution (validate) | Minimal placeholder | Require explicit user approval before subprocess execution |
| SSRF via GitHub proxy | Low risk — axios goes only to GitHub API | Keep domain whitelist in GitHubService |

---

## 8. Implementation plan

### Phase 0 (this report) — Audit ✅

### Phase 1 — AI Discovery + GitHub URL investigation
**New dependencies:** `groq-sdk` (or `@ai-sdk/groq`), `zod` (validation)  
**New services:** `SemanticDiscoveryService`, `QueryUnderstandingService`, `EmbeddingService`, `RepositoryRankingService`  
**New web pages:** `/discover` (AI search), `/investigate` (URL entry)  
**Estimated tests:** ~30

### Phase 2 — Workspace Manager
**New dependencies:** `simple-git` (Git abstraction), `uuid`  
**New services:** `WorkspaceManager`, `GitService`, `WorkspaceRegistry`  
**New CLI commands:** Enhanced `workspace` command with real clone  
**New API routes:** `/api/workspaces` (GET, POST)  
**Estimated tests:** ~25

### Phase 3 — Kiro Integration
**No new dependencies** (uses child_process / shell commands)  
**New services:** `KiroLauncherService`  
**New API routes:** `/api/workspaces/[id]/open`  
**Estimated tests:** ~10

### Phase 4 — Live Monitoring
**New dependencies:** `chokidar`  
**New services:** `WorkspaceMonitorService`, `WorkspaceEventService`  
**New API routes:** `/api/workspaces/[id]/status`, `/api/workspaces/[id]/diff`  
**Estimated tests:** ~20

### Phase 5 — Live Dashboard
**New dependencies:** None (use Next.js built-in SSE via Response stream)  
**New web pages:** `/workspaces/[id]` (6 tabs)  
**New API routes:** `/api/workspaces/[id]/events` (SSE)  
**Estimated tests:** ~15

### Phase 6 — MCP Activity
**New MCP tools:** 7 new tools  
**Estimated tests:** ~15

### Phase 7 — Validation & Release
**New services:** `ValidationService`, `ContributionReportService`  
**New web pages:** `/workspaces/[id]/validate`, `/workspaces/[id]/release`  
**Estimated tests:** ~15

### Phase 8 — Integration & Hardening
Security review, end-to-end test, CI verification.

---

## 9. Existing test and CI status

| Item | Status |
|---|---|
| Test framework | Vitest 3.x (forks pool) |
| Test files | 11 |
| Passing tests | 186/186 |
| Coverage (lines) | ~42% |
| Coverage (branches) | ~69% |
| Coverage (functions) | ~61% |
| GitHub Actions CI | `.github/workflows/ci.yml` — Node 18/20/22 matrix |
| Production CVEs | 0 |
| Dev CVEs | 7 (Vitest tinypool — dev-only, documented) |

**No pre-existing test failures.** The Vitest/tinypool advisory cannot be fixed without upgrading to Vitest 4+, which has an unresolvable `@oxc-project/types` dependency.

---

## 10. Environment variables

| Variable | Used by | Required |
|---|---|---|
| `GITHUB_TOKEN` | CLI, MCP server, web API routes | Recommended (5000 req/hr) |
| `GITHUB_OAUTH_TOKEN` | CLI, MCP server | Alternative to GITHUB_TOKEN |
| `GITHUB_TOKEN_TYPE` | CLI | Optional (auto-detected) |
| `GROQ_API_KEY` | Phase 1 (not yet present) | Required for AI discovery |
| `EMBEDDING_PROVIDER` | Phase 1 (not yet present) | Optional (defaults to local) |
| `REPOSOUL_WORKSPACE_DIR` | Phase 2 (not yet present) | Optional (defaults to `~/REPOSOUL/workspaces`) |
| `REPOSOUL_MONITOR_SECRET` | Phase 4 (not yet present) | Required for local event auth |

---

## 11. Recommended new directory structure

```
src/
├── services/
│   ├── [existing 14 services]
│   ├── semantic-discovery.ts       Phase 1
│   ├── query-understanding.ts      Phase 1
│   ├── embedding-service.ts        Phase 1
│   ├── repository-ranker.ts        Phase 1
│   ├── workspace-manager.ts        Phase 2
│   ├── git-service.ts              Phase 2
│   ├── workspace-registry.ts       Phase 2
│   ├── kiro-launcher.ts            Phase 3
│   ├── workspace-monitor.ts        Phase 4
│   ├── workspace-events.ts         Phase 4
│   ├── validation-service.ts       Phase 7
│   └── contribution-report.ts      Phase 7
web/app/
├── [existing pages]
├── discover/page.tsx               Phase 1
├── workspaces/
│   ├── page.tsx                    Phase 2
│   └── [id]/page.tsx               Phase 5
└── api/
    ├── [existing 3 routes]
    ├── ai-search/route.ts          Phase 1
    ├── workspaces/route.ts         Phase 2
    ├── workspaces/[id]/
    │   ├── route.ts
    │   ├── open/route.ts           Phase 3
    │   ├── status/route.ts         Phase 4
    │   ├── diff/route.ts           Phase 4
    │   ├── events/route.ts         Phase 5
    │   └── validate/route.ts       Phase 7
```

---

## Summary

The existing REPOSOUL codebase is a **well-structured, clean TypeScript CLI and Next.js 16 dashboard** with solid foundations:
- 13 working CLI commands
- 5 MCP tools
- 3 dashboard pages
- 186 passing tests
- 0 production CVEs

The gap to the full platform vision is significant but well-defined:
- **Phase 1** (AI Discovery) is the highest-value new feature
- **Phase 2** (Workspace Manager with real Git clone) is the most architecturally important
- **Phases 3–7** build on those foundations

All implementations will preserve the existing CLI, MCP tools, test suite, and architecture patterns.
