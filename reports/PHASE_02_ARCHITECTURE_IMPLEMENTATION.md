# REPOSOUL Phase 2 — Architecture Implementation Report

**Date:** 2026-11-26

---

## Changes made

All changes are incremental. No structural rewrites. Existing CLI commands unaffected.

### 1. Duplicate interface consolidation

**Problem:** `PredictionConfig`, `EnhancedRepositoryAnalysis`, `TrainingDataPoint`, `MLModel`, `MLPrediction` were declared locally in service files AND also existed in `src/types/index.ts`.

**Fix:** Removed local declarations from `ml-trainer.ts` and `ml-predictor.ts`. Both now import from `../types` and re-export via `export type {}` for backward compatibility.

```typescript
// ml-trainer.ts — before
export interface TrainingDataPoint { ... }  // 60 LOC duplicated

// ml-trainer.ts — after
import { TrainingDataPoint, MLModel, MLPrediction } from '../types';
export type { TrainingDataPoint, MLModel, MLPrediction } from '../types';
```

**Result:** Single source of truth. No divergence risk.

### 2. GitHubService API expansion

**Problem:** `OrganizationScanner` bypassed `GitHubService` abstraction via `this.githubService.api.get(...)` — coupling it directly to the internal axios instance.

**Fix:** Added four new public methods to `GitHubService`:
- `getOrganization(orgLogin)` → `GET /orgs/:login`
- `getUser(userLogin)` → `GET /users/:login`
- `getOrganizationRepos(orgLogin, type, sort, direction, page, perPage)` → `GET /orgs/:login/repos`
- `getUserPublicRepos(userLogin, sort, direction, page, perPage)` → `GET /users/:login/repos`

Updated `OrganizationScanner` to call these methods.

### 3. `dist/` pre-build clean

**Problem:** `dist/kraven.js` and `dist/kraven.d.ts` from the pre-rebrand build persisted across builds.

**Fix:** Added `prebuild` script to `package.json` that deletes `dist/` before `tsc` runs. No external dependencies (uses inline Node.js).

### 4. `getSocialSignals` non-determinism fixed

**Problem:** `MLTrainer.getSocialSignals()` returned `Math.random()` values, making each training run produce different model weights for the same input data.

**Fix:** Returns deterministic zeros with a prominent warning comment explaining the limitation and the Phase 3 resolution path.

### 5. `@types/commander` removed

Commander v14 ships its own TypeScript declarations. `@types/commander@2.12.0` was for Commander v2 and caused type conflicts.

### 6. `engines` field added

```json
"engines": { "node": ">=18.0.0", "npm": ">=9.0.0" }
```

Enforces the Node 18 requirement (needed for global `fetch`).

### 7. `eslint` and `prettier` configured

- `eslint.config.mjs` — flat config using `@typescript-eslint` rules
- `.prettierrc` — consistent formatting rules
- Phase 2 baseline: 0 errors, 116 warnings (all acceptable `warn`-level)

---

## What was deliberately NOT changed

| Item | Reason |
|---|---|
| CLI command names (`hunt`, `analyze`, etc.) | Phase 2 boundary — rename to `discover`/`investigate` is Phase 3 |
| Two HTTP stacks (axios + fetch) | Acceptable for Phase 2; unify in Phase 3 |
| `isVersionVulnerable()` always-true placeholder | Requires real vuln DB integration — Phase 3 |
| Organization scanner formatter logic in `cli.ts` | Low-risk; extract to `src/formatters/` in Phase 3 |
| `noUnusedLocals` in tsconfig | Would generate ~50 build errors from existing code; Phase 3 clean-up |
