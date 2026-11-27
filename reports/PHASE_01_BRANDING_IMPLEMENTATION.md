# REPOSOUL Phase 1 — Branding Implementation Report

**Date:** 2026-11-26

---

## New identity

- **Product:** REPOSOUL
- **Tagline:** Give abandoned software a second life.
- **Category:** Open Source Resurrection Workbench
- **Description:** An AI-powered open-source resurrection workbench that helps developers
  discover abandoned repositories, investigate their technical condition, generate revival
  blueprints and work with Kiro IDE to rebuild and validate projects.

---

## Branding changes

### Source code

1. **`src/kraven.ts` → `src/reposoul.ts`** — file renamed
   - Class `KravenHunter` → `ReposoulHunter` (all references updated)
   - Env-loading comments and variable names updated
2. **`src/cli.ts`** — Commander program name `kraven` → `reposoul`; description updated
   to REPOSOUL tagline; hunt spinner text rebranded; all embedded usage examples updated
   (`reposoul hunt …`, `reposoul analyze …`, `reposoul train …`); markdown report headers
   updated to "REPOSOUL — Repository Discovery/Analysis Results"
3. **`src/index.ts`** — import path and export name updated for renamed class
4. **`src/types/index.ts`** — `KravenConfig` → `ReposoulConfig`; appended
   `REPOSOUL_BRAND`, `REPOSOUL_COLORS`, `REPOSOUL_TERMINAL` design tokens
5. **User-Agent strings** in all service files updated:
   - `github.ts`, `dependency-analyzer.ts`, `fork-analyzer.ts` → `REPOSOUL/1.0.0`
   - `ml-trainer.ts` → `REPOSOUL-ML-Trainer/1.0.0`
   - `multi-language-analyzer.ts` → `REPOSOUL-MultiLang/1.0.0`
   - `go/java/rust-analyzer.ts` → `REPOSOUL-<Lang>-Analyzer/1.0.0`

### Package metadata

6. **`package.json`**:
   - `name`: `kraven` → `reposoul`
   - `bin`: `kraven` → `reposoul`
   - `description`: updated to REPOSOUL description
   - `keywords`: updated to REPOSOUL-appropriate terms
   - `license`: `ISC` → `MIT` (fixing an upstream mismatch — LICENSE file was already MIT)
   - `test` script: replaced intentionally-failing placeholder with an honest
     no-test-suite message (exit 0)
7. **`package-lock.json`** — regenerated; 0 references to old name, 2 to `reposoul`

### Visual identity (Step D)

8. **New brand assets** (`assets/`):
   - `reposoul-logo.svg` — phoenix mark in ember-gradient on dark surface
   - `reposoul-icon.svg` — icon-only variant, works on dark and light
   - `favicon.svg` — 32×32 favicon with rounded dark background
   - `social-preview.svg` — 1280×640 social card with product name, tagline, and
     Kiroween 2026 callout
   - `theme-tokens.json` — reusable design token system (colors, gradients, typography,
     spacing, radius, browser metadata)
9. **Old spider logo** (`kraven.png`) deleted — brand asset, superseded
10. **Token system in code** — `src/types/index.ts` exports the token constants so the
    CLI and future dashboard consume a single source of truth

### Documentation (Step F)

11. `README.md` — complete rewrite: product intro, tagline, problem statement, verified
    functionality (explicitly separating implemented/in-progress/planned), vision,
    architecture, stack, installation, development, verified CLI usage, screenshot
    placeholders, roadmap, Kiro integration vision, contribution, license, attribution
12. `CONTRIBUTING.md` — rewritten: standards, commit style, honest testing gap, structure
13. `DEPLOYMENT.md` — rewritten: current local model, future npm publication gating,
    removed obsolete GitHub Pages instructions (no web frontend exists)
14. `GLOBAL_INSTALL.md` — rewritten: generic paths (removed previous developer's
    machine-specific paths)
15. `examples.md` — rewritten, all `reposoul` commands
16. `setup-token.md` — rewritten: token name, env vars, scopes
17. `TECH-DEBT-METRICS.md` — rebranded header and references; technical content preserved

### Attribution (Step G)

18. `NOTICE.md` created — upstream name/URL/license/copyright, fork-point SHA,
    inherited-component inventory table (upstream path → REPOSOUL path → modification),
    new-work list, third-party dependency licenses, non-affiliation statement
19. `LICENSE` preserved **unmodified** (upstream MIT, copyright (c) 2025 Kraven Project)

### Kiro foundation (Step H)

20. `.kiro/` structure created:
    - `steering/product.md` — identity, mission, principles, user journey, scope
    - `steering/architecture.md` — current modules, data flow, planned phases, Kiro boundary
    - `steering/coding-standards.md` — TS conventions, naming, error handling, testing plan
    - `steering/security.md` — token protection, workspace boundaries, subprocess rules,
      approval requirements, redaction checklist
    - `steering/licensing-and-attribution.md` — MIT obligations, naming rules, third-party policy
    - `specs/` (README placeholder), `agents/`, `hooks/`, `settings/` directories
21. No Kiro agent/hook/MCP configuration created — out of scope for Phase 1

---

## Git detachment (Step B)

- Verified: `git remote -v` showed `origin → https://github.com/twansolo/kraven.git`
- Recorded: HEAD SHA `2d1c407963865a9ab6c7352c418e1d008ee7c555` (branch `main`)
- Confirmed no nested `.git` directories or submodules existed
- `.git/` directory deleted
- Verified post-deletion: `git remote -v` and `git log` return
  `fatal: not a git repository (or any of the parent directories): .git`
- No replacement git repository initialized; no new remote; nothing published

---

## Command-name mapping (Step E decision)

Current commands are preserved with their existing names (`hunt`, `analyze`, `forks`,
`train`, `scan`, `scan-multi`, `languages`, `ml-info`, `rate-limit`) because renaming
them to the future surface (`discover`, `investigate`, …) requires deprecation handling
that belongs to Phase 2. This is documented in `.kiro/steering/product.md`.
