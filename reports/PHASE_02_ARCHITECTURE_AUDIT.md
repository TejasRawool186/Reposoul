# REPOSOUL Phase 2 — Architecture Audit

**Date:** 2026-11-26
**Auditor:** Kiro agent (Principal Architect + Senior TypeScript Engineer)
**Scope:** Full codebase, dependencies, security, testing gaps, technical debt

---

## 1. Project state at Phase 2 start

| Item | Status |
|---|---|
| Package name | `reposoul` ✅ |
| CLI binary | `reposoul` ✅ |
| TypeScript build | Passes (`tsc` exit 0) ✅ |
| Git repository | No `.git` directory ✅ (Phase 1 detached) |
| `.env` file | Not present ✅ |
| Test suite | None ❌ (critical gap) |
| CI pipeline | None ❌ |
| Linter / formatter | None ❌ |
| `dist/` stale artifacts | Contains `kraven.js`, `kraven.d.ts` (old name) ⚠️ |

---

## 2. Current architecture

### Module inventory

```
src/
├── cli.ts                          (~700 LOC) Commander CLI — 9 commands
├── reposoul.ts                     (~175 LOC) ReposoulHunter orchestrator
├── index.ts                        (~15 LOC)  Library exports + default export
├── types/
│   └── index.ts                    (~220 LOC) All shared interfaces + brand tokens
└── services/
    ├── github.ts                   (~220 LOC) GitHubService — axios REST client
    ├── analyzer.ts                 (~250 LOC) RepositoryAnalyzer — scoring engine
    ├── dependency-analyzer.ts      (~330 LOC) DependencyAnalyzer — npm + dispatch
    ├── multi-language-analyzer.ts  (~310 LOC) MultiLanguageAnalyzer — lang routing
    ├── fork-analyzer.ts            (~380 LOC) ForkAnalyzer — fork ecosystem
    ├── ml-trainer.ts               (~560 LOC) MLTrainer — training + persistence
    ├── ml-predictor.ts             (~370 LOC) MLPredictor — prediction + blending
    ├── organization-scanner.ts     (~560 LOC) OrganizationScanner — tech debt
    └── language-analyzers/
        ├── python-analyzer.ts      (~310 LOC)
        ├── rust-analyzer.ts        (~310 LOC)
        ├── go-analyzer.ts          (~280 LOC)
        └── java-analyzer.ts        (~295 LOC)
```

### Module responsibilities (Principal Architect view)

| Module | Responsibility | Concerns |
|---|---|---|
| `cli.ts` | Commander-based CLI, all 9 commands, table/markdown/json formatters | Very large (~700 LOC); formatter logic mixed into CLI file |
| `reposoul.ts` | `ReposoulHunter` — orchestrates search + analyze + ML | Clean; acceptable |
| `github.ts` | Axios REST client, PAT/OAuth auth, search, repo, issues, commits, rate-limit | Mixes auth setup, header building and API calls; testable via constructor injection |
| `analyzer.ts` | Rule-based abandonment/revival/community scoring | Also constructs DependencyAnalyzer and MLPredictor internally (leaks dependencies) |
| `dependency-analyzer.ts` | npm health + multi-lang dispatch | Calls GitHub API directly via axios (not via GitHubService); `User-Agent` inconsistency risk |
| `multi-language-analyzer.ts` | Language detection, file discovery, dispatch to language analyzers | Also calls GitHub API directly; independent axios calls |
| `fork-analyzer.ts` | Fork activity, divergence, ranking | Uses `fetch` (global) alongside axios; two HTTP stacks in one project |
| `ml-trainer.ts` | Feature extraction, linear/logistic regression, training, persistence | Also uses `fetch` (not axios); social-signal data is randomly generated placeholder (not documented in-code) |
| `ml-predictor.ts` | Model loading, prediction, blending | Acceptable; depends on `ml-trainer.ts` for type definitions only |
| `organization-scanner.ts` | Org/user scans, tech-debt financial metrics | Uses `githubService.api` (direct axios instance access, bypasses service abstraction) |
| Language analyzers | Per-language dependency parsing and version checks | Each has its own axios instance with no shared retry/timeout policy; duplicated pattern |

---

## 3. Critical architectural problems

### 3.1 Duplicate interface declarations (HIGH)

`PredictionConfig` and `EnhancedRepositoryAnalysis` are declared in **both** `src/services/ml-predictor.ts` and `src/types/index.ts`. `TrainingDataPoint`, `MLModel`, and `MLPrediction` are declared in `src/services/ml-trainer.ts` and also re-appear in `src/types/index.ts`. The same interface is consumed from two different locations by different importers, creating divergence risk.

### 3.2 Two HTTP client stacks (HIGH)

`fork-analyzer.ts` and `ml-trainer.ts` use the **global `fetch`** API; all other service files use **axios**. This creates:
- Inconsistent error handling (axios wraps in `AxiosError`; fetch requires manual `.ok` checks)
- Inconsistent timeout/retry policy
- Harder to mock in tests (need to mock both `fetch` and `axios`)

### 3.3 Direct `githubService.api` access from OrganizationScanner (MEDIUM)

`organization-scanner.ts` calls `this.githubService.api.get(...)` directly, bypassing the `GitHubService` method abstraction. This couples OrganizationScanner to the internal axios instance and prevents upgrading the HTTP client without touching the scanner.

### 3.4 Hardcoded social signal data in MLTrainer (MEDIUM)

`getSocialSignals()` in `ml-trainer.ts` returns `Math.random()` for `awesomeListMentions`, `stackoverflowMentions`, `redditMentions`, `blogPostMentions`. This is unintentional randomness injected into training features — it makes training non-deterministic and silently degrades model quality. The code comment says "placeholder data" but callers have no way to know.

### 3.5 Stale `dist/` artifacts (LOW but visible)

`dist/kraven.js` and `dist/kraven.d.ts` are present from pre-rebrand builds. Users doing `import ... from 'dist/kraven'` could inadvertently import the old file. `dist/` should be cleaned before each build.

### 3.6 No error class hierarchy (LOW)

All errors are thrown as generic `new Error(...)` strings. No custom error classes. Makes catch-and-classify impossible without string matching.

### 3.7 Formatter logic inside `cli.ts` (LOW)

`printTableResults`, `printMarkdownResults`, `printTableAnalysis`, `printMarkdownForkAnalysis`, `printTableOrganizationResults`, etc. are defined as free functions inside `cli.ts`. This makes them untestable without spawning the CLI process.

---

## 4. Existing dependencies

### Runtime

| Package | Version | Latest | Notes |
|---|---|---|---|
| `axios` | 1.12.1 | 1.21.1 | **32 CVEs** — HIGH priority update |
| `chalk` | 4.1.2 | 6.0.1 | v6 is ESM-only; v4 is fine for CommonJS |
| `commander` | 14.0.1 | 15.1.0 | Minor update available |
| `dotenv` | 16.4.5 | 18.0.10 | Update available |
| `ora` | 5.4.1 | 10.0.0 | v6+ is ESM-only; v5 is fine for CommonJS |

### Dev

| Package | Version | Latest | Notes |
|---|---|---|---|
| `@types/commander` | 2.12.0 | — | commander v14+ ships its own types; this is obsolete |
| `@types/node` | 24.3.3 | 26.6.10 | Minor update available |
| `nodemon` | 3.1.10 | 3.1.14 | Patch update available |
| `ts-node` | 10.9.2 | — | Current; fine |
| `typescript` | 5.9.2 | 7.0.2 | TS 7 is a major; stay on 5.x for now |

---

## 5. Security vulnerabilities (npm audit)

**Total: 7 vulnerabilities (1 low, 1 moderate, 5 high)**

| Package | Severity | Root cause | Via | Fix available |
|---|---|---|---|---|
| `axios` 1.0.0–1.19.0 | **HIGH** (many CVEs) | SSRF, prototype pollution, CRLF, header injection, DoS — 32 advisories | Direct dependency | `npm audit fix` → upgrades to 1.21.1 |
| `brace-expansion` ≤1.1.20 | **HIGH** | ReDoS / memory exhaustion (7 CVEs) | Transitive (via `minimatch`→`nodemon`) | `npm audit fix` |
| `diff` 4.0.0–4.0.3 | **HIGH** | DoS via parsePatch/applyPatch | Transitive (via `nodemon`) | `npm audit fix` |
| `follow-redirects` ≤1.15.11 | **MODERATE** | Auth header leak on cross-domain redirect | Transitive (via `axios`) | Resolved by updating axios |
| `form-data` 4.0.0–4.0.5 | **HIGH** | CRLF injection | Transitive (via `axios`) | Resolved by updating axios |
| `minimatch` ≤3.1.3 | **HIGH** | ReDoS (3 CVEs) | Transitive (via `nodemon`) | `npm audit fix` |
| `picomatch` ≤2.3.1 | **HIGH** | ReDoS + method injection (2 CVEs) | Transitive (via `nodemon`) | `npm audit fix` |

**Assessment:** `npm audit fix` (non-force) should be safe for all 7 — `axios` upgrades within v1 (1.12.1→1.21.1), `nodemon` transitives resolved by updating `nodemon`. Must verify axios 1.21.1 is not breaking before accepting.

---

## 6. TypeScript configuration

```json
{
  "strict": true,
  "moduleResolution": "node",
  "module": "commonjs",
  "target": "ES2020"
}
```

- `strict: true` is on — good
- `noUnusedLocals` / `noUnusedParameters` are **not set** — there are likely unused variables
- `skipLibCheck: true` — hides potential type errors in `node_modules`; acceptable
- `declaration: true`, `declarationMap: true`, `sourceMap: true` — good for library consumers
- No `outDir` clean step before build — stale `kraven.*` files persist

---

## 7. Testing gaps

| Area | Coverage | Priority |
|---|---|---|
| Abandonment scoring math | None | **Critical** |
| Revival potential scoring | None | **Critical** |
| GitHub service (auth, search, error paths) | None | **Critical** |
| Dependency analyzer (npm) | None | **High** |
| Language analyzers (parsers) | None | **High** |
| ML predictor (model loading, fallback) | None | **High** |
| Fork analyzer | None | **Medium** |
| Organization scanner | None | **Medium** |
| CLI commands (integration) | None | **Medium** |
| Brand/design tokens | None | Low |

**No test framework is installed.** `npm test` currently prints a message and exits 0.

---

## 8. Code quality observations

1. **Large functions in `cli.ts`**: `printTableOrganizationResults` alone is ~100 LOC inline. These need extraction.
2. **`isVersionVulnerable` placeholder**: Returns `true` unconditionally in `dependency-analyzer.ts`, `java-analyzer.ts`. All versions are reported as vulnerable regardless.
3. **ML social signals are randomly generated**: Non-deterministic training data injected silently.
4. **No consistent error types**: `catch (error)` blocks use `error instanceof Error ? error.message : error` pattern — correct but cannot differentiate GitHub rate-limit from network failure.
5. **`KravenHunter` comment preserved in `kraven.d.ts`**: Stale declaration file in `dist/`.
6. **`@types/commander` is obsolete**: Commander v14 ships its own types; `@types/commander@2.12.0` likely causes type conflicts.
7. **No `engines` field in `package.json`**: Requires Node 18+ (global `fetch`) but nothing enforces this.

---

## 9. Recommended Phase 2 improvements

### Must-do

1. **Install Vitest** — testing is the highest-priority gap
2. **Update axios** to ≥1.21.1 (resolves 32+ CVEs and 3 transitive vulnerabilities)
3. **Update nodemon** to resolve brace-expansion, diff, minimatch, picomatch
4. **Clean `dist/` before build** — add `rimraf` pre-build script
5. **Remove `@types/commander`** — obsolete, potentially conflicting
6. **Create `.gitignore`** — does not exist for a fresh git repo (Phase 1 preserved an old one; needs review)
7. **Add `engines` field** to `package.json`
8. **Init git + add remote** (Step B)

### Should-do

1. **Consolidate duplicate interface declarations** — move `PredictionConfig`, `EnhancedRepositoryAnalysis` out of `ml-predictor.ts` to `types/index.ts`; same for `TrainingDataPoint`, `MLModel`, `MLPrediction` from `ml-trainer.ts`
2. **Add `OrganizationScanner` API methods** to `GitHubService` to remove `.api` bypass
3. **Document `getSocialSignals` randomness** clearly and add a note to testing docs
4. **Add `noUnusedLocals` and `noUnusedParameters`** to tsconfig after resolving existing violations

### Nice-to-have (Phase 2 scope if time allows)

1. Extract formatter functions from `cli.ts` to a `src/formatters/` module
2. Shared axios interceptor for retry/timeout across all services
3. Custom `ReposoulError` base class

---

## 10. Risks of proposed modifications

| Change | Risk | Mitigation |
|---|---|---|
| axios 1.12.1 → 1.21.1 | Possible behavior change in proxy/redirect handling | Run CLI smoke test after update; check axios changelog |
| nodemon transitive update | No CLI impact (dev-only) | Low risk |
| Remove `@types/commander` | May remove override types | Compile and verify after removal |
| Move interfaces to `src/types/index.ts` | Importers of `ml-predictor.ts` will get type from different path | Update all import sites; build verifies correctness |
| `noUnusedLocals` in tsconfig | May reveal existing violations causing build failure | Only enable after fixing all violations |
| Clean `dist/` before build | Requires `rimraf` or `rm -rf`; fine on all platforms with the right script | Use `rimraf` package or `tsc --clean` (not available in older tsc) |

---

**Conclusion:** The architecture is sound for a CLI tool at this stage. The critical gaps are (1) no tests, (2) axios CVEs, (3) duplicate interface declarations, and (4) no CI. Phase 2 addresses all of these without requiring a structural rewrite.
