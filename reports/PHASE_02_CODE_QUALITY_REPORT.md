# REPOSOUL Phase 2 — Code Quality Report

**Date:** 2026-11-26

---

## TypeScript configuration

| Setting | Value | Notes |
|---|---|---|
| `strict` | `true` | All strict-mode checks enabled |
| `moduleResolution` | `node` | Fixed from upstream `bundler` (pre-existing build failure) |
| `noUnusedLocals` | not set | ~50 violations in existing code; defer to Phase 3 |
| `noUnusedParameters` | not set | Same reason |
| `skipLibCheck` | `true` | Acceptable for a CLI tool |
| `declaration` | `true` | Type declarations emitted for library consumers |

### TypeScript check result

```
npm run typecheck → exit 0 (zero errors)
npm run build    → exit 0 (zero errors)
```

---

## ESLint

**Configuration:** `eslint.config.mjs` (flat config, `@typescript-eslint` v8)

**Result:** 0 errors, 116 warnings

**Errors fixed in Phase 2:**
- `prefer-const` on `let currentSection` in `go-analyzer.ts` (dead variable)
- `prefer-const` on `let weights` in `ml-trainer.ts` (array mutated in place, variable never re-bound)

**Remaining warnings (acceptable):**
- `@typescript-eslint/no-unused-vars` × ~90 — `catch (error)` blocks in existing service code that never reference the error. These match the pattern `catch (error) { throw new Error(...) }` where the original error is not used. Fixing requires touching every service's error handling — Phase 3 task.
- `@typescript-eslint/no-explicit-any` × ~20 — ML model data structures and GitHub API responses use `any`. Phase 3 task: introduce proper typed interfaces.

**Lint policy:** Warnings do not block CI (`continue-on-error: true` in workflow). Errors block CI.

---

## Prettier

**Configuration:** `.prettierrc` (singleQuote, trailingComma: es5, printWidth: 100)

The existing codebase uses mixed quote styles and inconsistent trailing commas. Prettier is configured but `format` has not been run across the whole codebase to avoid a 50-file diff that obscures functional changes. This is documented as a Phase 3 task.

---

## New scripts added

| Script | Command | Purpose |
|---|---|---|
| `build` | `tsc` (with prebuild clean) | Compile TypeScript, clean dist/ first |
| `typecheck` | `tsc --noEmit` | Type-check without emitting |
| `test` | `vitest run` | Single-pass test suite |
| `test:watch` | `vitest` | Watch mode for development |
| `test:coverage` | `vitest run --coverage` | With V8 coverage report |
| `lint` | `eslint src tests --ext .ts` | Static analysis |
| `lint:fix` | `eslint ... --fix` | Auto-fix ESLint errors |
| `format:check` | `prettier --check ...` | Verify formatting |
| `format` | `prettier --write ...` | Apply formatting |

---

## Removed

- `@types/commander@2.12.0` — obsolete; Commander v14 ships its own types

---

## Phase 3 code quality tasks

1. Run `prettier --write` across all source files in a dedicated formatting PR
2. Enable `noUnusedLocals` and `noUnusedParameters` after fixing violations
3. Replace `any` in ML model types with proper interfaces
4. Address unused `catch (error)` patterns — either use `_error` or log the original
5. Extract formatter functions from `cli.ts` to `src/formatters/` module
