# REPOSOUL Phase 2 — Testing Report

**Date:** 2026-11-26

---

## Test framework

- **Vitest 3.2.7** (forks pool, 10s timeout, globals enabled)
- **@vitest/coverage-v8 3.2.7** — V8 native coverage

## Test results

```
Test Files  8 passed (8)
     Tests  88 passed (88)
  Duration  ~8–13s
```

**All 88 tests pass. Zero failures.**

---

## Test files

| File | Tests | Coverage target |
|---|---|---|
| `tests/unit/services/github.test.ts` | 16 | GitHubService — auth, search, getRepository, getRateLimit, org methods |
| `tests/unit/services/analyzer.test.ts` | 19 | RepositoryAnalyzer — scoring, ranges, edge cases |
| `tests/unit/services/reposoul-hunter.test.ts` | 15 | ReposoulHunter — constructor, hunt, analyzeRepository, ML delegation |
| `tests/unit/services/ml-predictor.test.ts` | 9 | MLPredictor — model loading, getModelInfo, enhanceAnalysis fallback |
| `tests/unit/services/fork-analyzer.test.ts` | 6 | ForkAnalyzer — shape, edge cases, error wrapping |
| `tests/unit/services/dependency-analyzer.test.ts` | 9 | DependencyAnalyzer — language support, dispatch |
| `tests/unit/analyzers/python-analyzer.test.ts` | 8 | PythonAnalyzer — requirements.txt parsing, health |
| `tests/unit/analyzers/go-analyzer.test.ts` | 6 | GoAnalyzer — go.mod parsing, proxy mock |

---

## Coverage report

```
File                | % Stmts | % Branch | % Funcs | % Lines
--------------------|---------|----------|---------|--------
All files           |   33.76 |    61.76 |   56.49 |   33.76
src/reposoul.ts     |   83.96 |    60.00 |  100.00 |   83.96
analyzer.ts         |   92.64 |    69.13 |  100.00 |   92.64
dependency-analyzer |   23.16 |    63.63 |   28.57 |   23.16
fork-analyzer.ts    |   66.90 |    49.09 |   93.75 |   66.90
github.ts           |   48.09 |    53.48 |   58.82 |   48.09
ml-predictor.ts     |   23.14 |    81.25 |   30.00 |   23.14
ml-trainer.ts       |    0.00 |   100.00 |  100.00 |    0.00
multi-language-anal |   69.45 |    52.83 |   87.50 |   69.45
organization-scanner|    0.00 |   100.00 |  100.00 |    0.00
go-analyzer.ts      |   84.27 |    67.53 |   84.61 |   84.27
java-analyzer.ts    |    6.66 |   100.00 |    6.25 |    6.66
python-analyzer.ts  |   55.34 |    62.12 |   70.58 |   55.34
rust-analyzer.ts    |    6.32 |   100.00 |    5.88 |    6.32
```

**Coverage thresholds (all met):**
- Lines: 33.76% ≥ 30% ✅
- Statements: 33.76% ≥ 30% ✅
- Functions: 56.49% ≥ 40% ✅
- Branches: 61.76% ≥ 30% ✅

---

## Zero-coverage modules (documented, not hidden)

| Module | Reason | Priority for Phase 3 |
|---|---|---|
| `ml-trainer.ts` | Training requires real data + network; complex integration test | Medium |
| `organization-scanner.ts` | Integration test requiring mocked multi-page pagination | Medium |
| `java-analyzer.ts` | Maven XML parser needs fixture POM files | Low |
| `rust-analyzer.ts` | Cargo.toml parser needs fixture files | Low |

---

## Testing infrastructure

- `tests/fixtures/github.fixtures.ts` — deterministic `GitHubRepository` factory functions
- `tests/setup.ts` — global setup: suppresses console output, clears GitHub token env vars
- `vi.mock()` used throughout — no real network calls in any test
- `vi.stubGlobal('fetch', mockFetch)` — covers fork-analyzer's global fetch usage

---

## Known limitations

1. **`ml-trainer.ts` has 0% line coverage** — the training algorithm is complex (600+ LOC). Integration tests require a full dataset and several minutes of training time. These belong in a future `tests/integration/` suite.
2. **CLI integration tests not yet implemented** — `src/cli.ts` is excluded from coverage. A `tests/integration/cli.test.ts` using `child_process.spawn` would be valuable in Phase 3.
3. **Dependency analyzer tests rely on internal mock timing** — the 3 tests using `analyzeDependencies` take ~2s each due to multi-language detection logic. Consider refactoring the timeout in Phase 3.
