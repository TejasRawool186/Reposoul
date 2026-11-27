# Coding Standards — REPOSOUL

## TypeScript conventions

- `strict: true` (enforced in tsconfig.json); CommonJS output to `dist/`
- Prefer `interface` over `type` for object shapes
- Prefer `async/await`; use `Promise.allSettled` for parallel best-effort work (existing pattern)
- JSDoc on every exported class and public method
- No default exports except `src/index.ts` (existing convention)

## Naming

- Classes: `PascalCase` (`ReposoulHunter`, `GitHubService`)
- Interfaces: `PascalCase` (`RepositoryAnalysis`, `ReposoulConfig`)
- Files: `kebab-case.ts` matching primary export (`fork-analyzer.ts` → `ForkAnalyzer`)
- Language analyzers: `<language>-analyzer.ts`
- Variables/functions: `camelCase`; private methods may keep leading underscore if legacy
- Constants: `SCREAMING_SNAKE_CASE` (e.g. `REPOSOUL_BRAND`, `REPOSOUL_COLORS`)
- User-Agent strings: `REPOSOUL*` (never the old upstream name)

## Error handling

- Throw `Error` with a human-readable message including context (existing pattern:
  `` `Failed to fetch repository: ${...}` ``)
- External API calls: catch, classify, and either degrade gracefully or throw — never
  silently swallow (warnings via `console.warn` are the existing convention)
- CLI actions: catch, print with `chalk.red`, `process.exit(1)` (existing pattern)
- JSON output mode: never print anything except the JSON payload

## Testing expectations

- **Vitest 3.x** is the test framework (`npm test` runs `vitest run`)
- Every meaningful feature **must have unit tests** before merging
- External API calls **must be mocked** — no real network calls in unit tests
- Use fixtures in `tests/fixtures/` for deterministic test data — no `Math.random()`
- Current coverage: lines ~33%, branches ~61%, functions ~56%
- Coverage thresholds enforced in CI: lines/stmts 30%, functions 40%, branches 30%
- Raise thresholds when adding new tested modules
- Never fabricate test results

## Code organization

- One primary exported class per service file
- Shared types go in `src/types/index.ts` (single types module)
- Brand/color tokens live in `src/types/index.ts` (TS) and `assets/theme-tokens.json` (design)
- New data artifacts go under `data/`; brand assets under `assets/`; phase reports under `reports/`
- Dependency direction: `cli.ts` / `reposoul.ts` → services → types. Services must not import
  from `cli.ts`
- Comments in English; commit messages follow conventional commits (feat/fix/docs/refactor/test)

## Phase 2 engineering rules

- **Every new feature needs tests** before merging to `main`
- **Do not break existing CLI commands** — regression test after any service change
- **Never commit secrets** — `.env` is git-ignored; CI uses `--omit=dev` audit
- **External API calls must be mockable** — constructor-inject dependencies; never create HTTP clients inside functions
- **No duplicate interface declarations** — canonical types live in `src/types/index.ts`; services re-export via `export type {}`
- **No `.api` bypass** — add methods to `GitHubService` instead of accessing its internal axios instance
- **Avoid unnecessary dependencies** — justify each new package in the PR description
- **Document architectural decisions** — use inline comments for non-obvious choices; update `.kiro/steering/` for structural changes
- **Validate before marking tasks complete** — run `npm run build` + `npm test` + `npm run typecheck`
