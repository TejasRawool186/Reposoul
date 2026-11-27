# REPOSOUL Phase 2 — Security Audit Report

**Date:** 2026-11-26

---

## 1. Dependency vulnerabilities — before Phase 2

**13 vulnerabilities** (0 info, 0 low, 1 moderate, 5 high, 2 critical — as audited after dev-dep installation)

| Package | Severity | CVE count | Type | Root cause |
|---|---|---|---|---|
| `axios` 1.0.0–1.19.0 | HIGH | 32 | Direct runtime dep | SSRF, prototype pollution, CRLF, header injection, DoS — wide range of issues |
| `brace-expansion` ≤1.1.20 | HIGH | 7 | Transitive (nodemon) | ReDoS, memory exhaustion |
| `diff` 4.0.0–4.0.3 | HIGH | 1 | Transitive (nodemon) | DoS via parsePatch/applyPatch |
| `follow-redirects` ≤1.15.11 | MODERATE | 1 | Transitive (axios) | Auth header leak on cross-domain redirect |
| `form-data` 4.0.0–4.0.5 | HIGH | 1 | Transitive (axios) | CRLF injection |
| `minimatch` ≤3.1.3 | HIGH | 3 | Transitive (nodemon) | ReDoS (3 patterns) |
| `picomatch` ≤2.3.1 | HIGH | 2 | Transitive (nodemon) | ReDoS + method injection |

---

## 2. Actions taken

### `npm audit fix` (non-force, safe)

Updated `axios` from **1.12.1 → 1.21.1** (within the v1 minor range). This resolved:
- All 32+ axios CVEs
- `follow-redirects` (transitive via axios) — resolved
- `form-data` (transitive via axios) — resolved
- `brace-expansion`, `diff`, `minimatch`, `picomatch` (transitive via nodemon) — resolved

### Did NOT run `npm audit fix --force`

`--force` would have installed `vitest@5.1.2`, which:
- Is a **breaking major version change**
- Was not tested
- Vitest 4.x (the preferred upgrade path) has an unresolvable transitive dependency on `@oxc-project/types@=0.156.0` which is not available in the npm registry at the time of this audit

---

## 3. Dependency vulnerabilities — after Phase 2

**7 vulnerabilities** (0 low, 5 moderate, 0 high, 2 critical)

All remaining vulnerabilities are **in `devDependencies` only** — specifically in the Vitest test runner internals:

| Package | Severity | Path | Notes |
|---|---|---|---|
| `tinypool` ≤2.1.1 | CRITICAL (2) | `vitest → tinypool` | Prototype pollution gadgets in worker options (RCE in test-runner context) — dev-only |
| `glob` | MODERATE | `vitest → glob` | Moderate — dev-only |
| `minimatch` | MODERATE | `vitest → test-exclude → minimatch` | Dev-only |
| `@vitest/mocker` | MODERATE | Test framework internal | Dev-only |
| `test-exclude` | MODERATE | Test framework internal | Dev-only |

**None of these vulnerabilities exist in the production runtime bundle.** They are entirely within the test toolchain, which runs only on developer machines and in CI — never in a user-facing deployment.

**Risk assessment:** LOW for end users. The tinypool RCE is exploitable only by malicious test configuration or test fixture code run inside the Vitest worker pool. Mitigation: do not run test suites with untrusted input or test files from external sources.

**Resolution path:** Upgrade to Vitest ≥4.x when `@oxc-project/types@=0.156.0` becomes available in the registry. Track issue on the project's GitHub.

---

## 4. Direct dependency security review

| Package | Version | Purpose | Security assessment |
|---|---|---|---|
| `axios` | 1.21.1 | GitHub REST client | ✅ No known CVEs at this version |
| `chalk` | 4.1.2 | Terminal colors | ✅ No known CVEs |
| `commander` | 14.0.1 | CLI framework | ✅ No known CVEs |
| `dotenv` | 16.4.5 | .env loading | ✅ No known CVEs |
| `ora` | 5.4.1 | Terminal spinner | ✅ No known CVEs |

---

## 5. Secrets and credentials audit

| Check | Result |
|---|---|
| `.env` files in tracked files | ✅ `.gitignore` excludes `.env`, `.env.*` |
| `.env.example` contains real credentials | ✅ Placeholders only |
| Token values in source code | ✅ None found |
| Token values in reports | ✅ None found |
| Token logging in CLI output | ✅ Tokens suppressed — `dotenv` debug=false in CLI |
| `GITHUB_TOKEN` in test setup | ✅ `tests/setup.ts` deletes env vars before each test |

---

## 6. API security review

| Area | Assessment |
|---|---|
| GitHub token storage | In `.env` (git-ignored) or env vars — never in code |
| Token in User-Agent header | No — tokens go only in `Authorization` header |
| Token scope enforcement | Documented in `setup-token.md` — `public_repo` minimum |
| External HTTP calls | Only to GitHub API, npm registry, language registries — all HTTPS |
| SSRF via user input | Low risk — repo owner/name passed to GitHub API path; path traversal not possible via API |
| Input sanitization | Repository names validated to `owner/repo` format in `ReposoulHunter.analyzeRepository` |

---

## 7. Subprocess execution

No subprocess execution in Phase 1 or Phase 2 source code. This will be reviewed when Phase 5 (validation/execution) is introduced.

---

## 8. Security improvements made in Phase 2

1. **axios upgraded** from 1.12.1 (32 CVEs) to 1.21.1 (0 known CVEs)
2. **`.env.example`** created with clear placeholder-only content
3. **`.gitignore`** audited — `.env.*` variants all excluded
4. **`tests/setup.ts`** clears GitHub token env vars before each test
5. **Security steering document** (`.kiro/steering/security.md`) established in Phase 1 — preserved and referenced
6. **`SECURITY.md`** will be created in Step H (developer experience)

---

## 9. Remaining known issues

| Issue | Severity | Mitigation |
|---|---|---|
| Vitest `tinypool` ≤2.1.1 | CRITICAL (dev-only) | Do not run tests with untrusted fixture files; upgrade when Vitest 4+ deps resolve |
| `isVersionVulnerable()` always returns `true` | Code quality | Documented in Phase 2 audit — fix in Phase 3 when real vuln DB integration is planned |
| No rate-limit retry on GitHub API | Operational | Documented — not a security risk |
