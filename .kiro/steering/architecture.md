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

### Phase 3 additions

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

## Planned future architecture

- **Phase 4:** REPOSOUL Dashboard — web frontend consuming the same services via a thin
  API layer; dark theme driven by `assets/theme-tokens.json`
- **Phase 5:** Kiro IDE integration

## Boundary between REPOSOUL and Kiro IDE

- REPOSOUL owns: discovery, investigation, scoring, blueprint generation
- Kiro IDE owns: execution of the revival — specs, tasks, agent-assisted coding,
  validation runs
- The handoff artifact is the **blueprint** (Phase 3+). REPOSOUL must not embed or
  depend on Kiro internals; integration happens through open formats (blueprint files,
  and later an MCP server, which is explicitly out of scope until Phase 5)
- No Kiro-specific code may be added before Phase 5 without a design review
