# REPOSOUL Phase 1 — Branding Scan Report

**Scan date:** 2026-11-26
**Scope:** All files except `node_modules/`, `dist/`, `.git/`, `package-lock.json`
**Method:** `Select-String` case-insensitive scan for: `kraven`, `twansolo`, `ejord`,
`KravenHunter`, `KravenConfig`, `abandoned project hunter`, spider emoji `🕷`

---

## Classification key

| # | Category |
|---|---|
| 1 | Legitimate legal attribution — required by MIT license |
| 2 | Historical upstream documentation — audit/provenance record |
| 3 | Unmodified third-party dependency — not our code |
| 4 | Missed branding — active user experience regression |
| 5 | Obsolete configuration — stale non-attribution reference |

---

## Scan results

### Source TypeScript files (`src/**/*.ts`)

| Pattern | Matches | Classification |
|---|---|---|
| `kraven` / `KravenHunter` / `KravenConfig` | **0** | — |

**Result: CLEAN.** All Kraven class names, variable names, User-Agent strings, and
in-code comments have been replaced. No missed branding.

---

### Package metadata (`package.json`, `package-lock.json`)

| File | Pattern | Matches | Classification |
|---|---|---|---|
| `package.json` | `"name": "kraven"` | **0** | — |
| `package.json` | `"name": "reposoul"` | 1 | Expected — package correctly renamed |
| `package-lock.json` | `"name": "kraven"` | **0** | — |
| `package-lock.json` | `"name": "reposoul"` | 2 | Expected |

**Result: CLEAN.**

---

### CLI runtime output (`node dist/cli.js --help`)

| Pattern | Matches | Classification |
|---|---|---|
| `kraven` / `🕷` | **0** | — |
| `reposoul` | Present — program name | Expected |
| `REPOSOUL` | Present — description | Expected |

**Result: CLEAN.** CLI shows correct product identity at runtime.

---

### Documentation files

| File | Remaining matches | Classification |
|---|---|---|
| `README.md` | 3 | **Category 1** — attribution section: `[Kraven](https://github.com/twansolo/kraven)` and "Kraven project" in §License and §Upstream attribution |
| `TECH-DEBT-METRICS.md` | 1 | **Category 1** — "inherited from the upstream Kraven project; see NOTICE.md" |
| `CONTRIBUTING.md` | 0 | Clean |
| `DEPLOYMENT.md` | 0 | Clean |
| `GLOBAL_INSTALL.md` | 0 | Clean |
| `examples.md` | 0 | Clean |
| `setup-token.md` | 0 | Clean |

---

### Attribution files (required)

| File | Content | Classification |
|---|---|---|
| `LICENSE` | `Copyright (c) 2025 Kraven Project` | **Category 1** — upstream copyright; must not be removed |
| `NOTICE.md` | Full upstream attribution inventory | **Category 1** — created specifically for REPOSOUL; content is required |

---

### Kiro steering documents

| File | Remaining matches | Classification |
|---|---|---|
| `.kiro/steering/product.md` | 1 | **Category 1** — "Preserve provenance (Kraven, MIT)" |
| `.kiro/steering/licensing-and-attribution.md` | 5 | **Category 1** — entire document is upstream attribution guidance |
| `.kiro/steering/architecture.md` | 0 | Clean |
| `.kiro/steering/coding-standards.md` | 0 | Clean |
| `.kiro/steering/security.md` | 0 | Clean |

---

### Phase reports

| File | Remaining matches | Classification |
|---|---|---|
| `reports/PHASE_01_INITIAL_AUDIT.md` | ~20 | **Category 2** — historical audit recording the pre-rebrand state; this is factual provenance, not active branding |

---

### Developer personal references

| Reference | Status |
|---|---|
| `C:\Users\ejord\...` path in GLOBAL_INSTALL.md | **Removed** |
| `@twansolo` social tag | **Removed** |
| `#KravenHunter` hashtag | **Removed** |
| Old GitHub Pages URL `twansolo.github.io/kraven` | **Removed** |
| Old npm package link `npmjs.com/package/kraven` | **Removed** |
| Spider emoji `🕷️` in active UI | **Removed** |
| Spider logo `kraven.png` | **Deleted** |

---

## Summary

| Category | Count | Action |
|---|---|---|
| Missed branding (category 4) | **0** | No action needed |
| Obsolete configuration (category 5) | **0** | No action needed |
| Legitimate attribution (category 1) | 29 | Preserve — required by MIT |
| Historical audit records (category 2) | ~20 | Preserve — provenance documentation |

**No missed branding remains in the active REPOSOUL user experience.**

All remaining references to `Kraven` and `twansolo` are either legally required upstream
attributions or historical audit records. Deleting them would violate the MIT license or
destroy provenance traceability.
