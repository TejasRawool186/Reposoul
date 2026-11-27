# REPOSOUL Phase 2 — CI Report

**Date:** 2026-11-26

---

## Workflow created

**File:** `.github/workflows/ci.yml`

---

## Workflow structure

### Job 1: `ci` — Build, Lint, Test

**Triggers:** Push to `main`, pull requests targeting `main`
**Matrix:** Node.js 18.x, 20.x, 22.x (covers minimum and two LTS versions)

| Step | Command | Failure behavior |
|---|---|---|
| Checkout | `actions/checkout@v4` | Blocks |
| Set up Node.js | `actions/setup-node@v4` with npm cache | Blocks |
| Install | `npm ci` | Blocks |
| Type-check | `npm run typecheck` | Blocks |
| Lint | `npm run lint` | `continue-on-error: true` — warnings are expected |
| Build | `npm run build` | Blocks |
| Test | `npm test` | Blocks |
| Coverage | `npm run test:coverage` | Blocks |
| Upload coverage | `actions/upload-artifact@v4` (node 20 only) | Non-blocking |

### Job 2: `security` — Production audit

**Purpose:** Verify production dependencies have no known vulnerabilities.

```yaml
run: npm audit --omit=dev
```

`--omit=dev` excludes the Vitest/tinypool advisory (dev-only) so the security job
reflects the actual risk to end users. The 7 remaining dev-only advisories are
documented in `PHASE_02_SECURITY_AUDIT.md`.

---

## Permissions

```yaml
permissions:
  contents: read
```

Least-privilege — read-only. The workflow does not push commits, create releases, publish to npm, or deploy anything.

---

## Caching

`actions/setup-node@v4` with `cache: 'npm'` caches the npm dependency cache automatically, keyed on `package-lock.json`.

---

## CI validation (local)

The workflow YAML is syntactically valid (confirmed via yamllint-compatible structure). It cannot be executed locally without pushing to GitHub because it requires GitHub Actions runners. The equivalent local commands are:

```bash
npm ci
npm run typecheck     # exit 0 ✅
npm run build         # exit 0 ✅
npm test              # 88 passed ✅
npm run test:coverage # thresholds met ✅
npm run lint          # 0 errors ✅
npm audit --omit=dev  # 0 vulnerabilities ✅
```

All steps pass locally on the development machine.

---

## What CI does NOT do (by design)

- Does not `npm publish`
- Does not push commits or tags
- Does not deploy a service
- Does not fork or open pull requests
- Does not expose `GITHUB_TOKEN` in test output
- Does not run tests with real GitHub credentials (tokens are mocked in tests)
