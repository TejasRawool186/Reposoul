# REPOSOUL Phase 1 — Initial Repository Audit

**Audit date:** 2026-11-26
**Auditor:** Kiro agent (Principal Architect role)
**Working directory:** `d:\kraven`
**Upstream origin (recorded before detachment):** `https://github.com/twansolo/kraven.git`
**HEAD SHA at audit time:** `2d1c407963865a9ab6c7352c418e1d008ee7c555` (branch `main`, feat: fixing moduleResolution deprecation)

---

## 1. Original Project Architecture

Kraven is a TypeScript CLI application (no web frontend, no backend server) that discovers and scores abandoned GitHub repositories. It is compiled with `tsc` to CommonJS and executed via `node dist/cli.js`.

```
src/
├── cli.ts                  # Commander-based CLI entry point (hunt, analyze, forks, train, scan, scan-multi, languages, ml-info, rate-limit)
├── index.ts                # Library exports
├── kraven.ts               # KravenHunter orchestration class (search + analyze + ML pipeline)
├── types/index.ts          # All shared TypeScript interfaces
└── services/
    ├── github.ts           # Axios GitHub API client (search, repos, issues, commits, rate limit, PAT/OAuth auth)
    ├── analyzer.ts         # RepositoryAnalyzer: abandonment/revival scoring, community metrics
    ├── dependency-analyzer.ts  # npm dependency analysis + multi-language dispatch
    ├── multi-language-analyzer.ts # Language detection and per-language analysis dispatch
    ├── fork-analyzer.ts   # Fork ecosystem comparison
    ├── ml-trainer.ts      # Training data collection, linear/logistic regression trainers
    ├── ml-predictor.ts    # Model loading + ML-enhanced predictions
    ├── organization-scanner.ts # Org/user scans, tech debt financial metrics
    └── language-analyzers/
        ├── python-analyzer.ts  # PyPI + OSV.dev
        ├── rust-analyzer.ts    # crates.io + RustSec
        ├── go-analyzer.ts      # Go proxy
        └── java-analyzer.ts    # Maven Central + GitHub advisories
```

**Data:** `data/ml-models.json` (trained model weights) and `data/training-data.json` (training samples) plus `data/sample-repositories.txt`.

**No web interface exists.** README/DEPLOYMENT.md reference a `docs/` web interface ("kraven.dev"), but no `docs/` directory, no HTML, no CSS and no JS frontend is present in this clone. The "GitHub Pages web app" described in the README is not in this repository. This is a verified discrepancy: the README overstates shipped functionality.

## 2. Existing Capabilities (verified from source)

- GitHub repository search with filters (language, stars, pushed dates, category keywords, private repos with token)
- Abandonment score, revival potential, community engagement, market relevance (rule-based)
- Dependency analysis for JavaScript/TypeScript (npm registry) with multi-language support (Python/PyPI, Rust/crates.io, Go proxy, Java/Maven)
- Fork ecosystem analysis (activity, divergence, maintainer responsiveness)
- ML layer: linear/logistic regression trained in-process, models persisted to `data/ml-models.json`; predictions blended with rule-based scores
- Organization/user scanning with tech-debt cost, time, security-risk and business-impact metrics
- Output in table, JSON, and markdown formats
- GitHub rate limit check; PAT and OAuth token support with auto-detection

## 3. Existing CLI Commands

| Command | Purpose |
|---|---|
| `hunt` | Search + analyze abandoned repositories |
| `analyze <owner/repo>` | Analyze one repository |
| `forks <owner/repo>` | Analyze fork ecosystem |
| `train` | Train ML models |
| `scan <org>` | Scan organization/user repos |
| `scan-multi <orgs>` | Compare multiple orgs |
| `languages` | Show supported languages |
| `ml-info` | ML model status |
| `rate-limit` | GitHub API rate limit status |

## 4. Frontend Entry Points

**None present.** (See §1 discrepancy note.)

## 5. Package Identity

- name: `kraven`, version 1.0.0, bin `kraven` → `dist/cli.js`
- license field says `ISC`, but the LICENSE file is **MIT** (copyright "Kraven Project", 2025). Mismatch to fix.
- author: empty
- scripts: build (tsc), start, dev (ts-node), watch (nodemon); `test` is a placeholder that always fails ("no test specified")
- dependencies: axios, chalk@4, commander, dotenv, ora; devDeps: @types/commander, @types/node, nodemon, ts-node, typescript

## 6. Branding References (to replace)

- `kraven` string across: README.md, CONTRIBUTING.md, DEPLOYMENT.md, GLOBAL_INSTALL.md, examples.md, setup-token.md, package.json, src/cli.ts, src/kraven.ts, kraven.png (spider logo)
- `KravenHunter` class in src/kraven.ts, imported in cli.ts, index.ts
- "The Abandoned Project Hunter" tagline, spider emoji 🕷️, `Kraven-Hunter/1.0.0` User-Agent strings in github.ts, dependency-analyzer.ts, fork-analyzer.ts, ml-trainer.ts, multi-language-analyzer.ts, and all four language analyzers
- `Kraven-ML-Trainer`, `Kraven-MultiLang`, `Kraven-Go-Analyzer`, `Kraven-Rust-Analyzer`, `Kraven-Java-Analyzer` User-Agents
- `KravenConfig` interface in types/index.ts
- README references `kraven.dev` website (actually a GitHub Pages URL), npm package, success stories and recognition claims that are unverifiable marketing copy

## 7. Old Personal Identity References

- GitHub org/username `twansolo` throughout README, CONTRIBUTING, DEPLOYMENT, .git remote
- Global developer path `C:\Users\ejord\...` in GLOBAL_INSTALL.md (previous developer's machine)
- "Kraven Hunter" token name in setup-token.md (product branding, not personal)
- No email addresses found

## 8. Git Configuration (recorded before removal)

- Root: `d:\kraven` is the git root (no nested .git directories found)
- Remote `origin` → `https://github.com/twansolo/kraven.git` (fetch/push)
- Branch `main`, tracking `origin/main`
- Initial audit SHA: `2d1c407963865a9ab6c7352c418e1d008ee7c555`
- No submodules (no `.gitmodules`)

## 9. Files Requiring Modification

- `package.json` (name, bin, description, keywords, license field fix)
- `package-lock.json` (regenerate after name change)
- `src/cli.ts` (program name, descriptions, usage examples, spinner text)
- `src/kraven.ts` (rename class, env path comments)
- `src/index.ts` (exports)
- `src/types/index.ts` (KravenConfig)
- All `src/services/*.ts` (User-Agent strings)
- `README.md` (complete rewrite)
- `CONTRIBUTING.md`, `DEPLOYMENT.md`, `GLOBAL_INSTALL.md`, `examples.md`, `setup-token.md`, `TECH-DEBT-METRICS.md` (rebrand)
- `tsconfig.json` (already fixed: moduleResolution bundler→node, see §12)

## 10. Files Requiring Preservation

- `LICENSE` (MIT, upstream copyright — unchanged)
- `data/*` (ML artifacts)
- All service implementations (functionality preserved, only identity strings change)

## 11. License and Attribution Considerations

- Upstream LICENSE is MIT, copyright (c) 2025 Kraven Project. Must be preserved verbatim; REPOSOUL is a derivative work under MIT.
- NOTICE.md to be created documenting upstream provenance.
- package.json license field must be corrected to MIT.
- The `kraven.png` spider logo: replaced with a new REPOSOUL phoenix logo (original asset removed from active branding; it is a brand asset, not a copyright notice, and is superseded).

## 12. Build and Test Baseline (run before changes)

- `npm install`: succeeded after one network failure (ECONNRESET), retried with `--prefer-offline`, OK. 7 audit warnings (1 low, 5 high, 1 moderate) — pre-existing.
- `npm run build` (tsc): **FAILED** initially with `TS5095: Option 'bundler' can only be used when 'module' is set to 'preserve' or to 'es2015' or later.` — pre-existing upstream defect (the last upstream commit attempted to fix a deprecation but left an invalid config). Fixed minimally by setting `moduleResolution: "node"`. Build now passes clean.
- `npm test`: no test framework exists; script exits 1 by design. **No test suite is present in the upstream project.**
- CLI startup (`node dist/cli.js --help`) works; output still shows Kraven branding at this point (expected; rebrand pending).

## 13. Verification of Claims vs Reality

- README claims: web interface, npm published package, GitHub Pages site, browser extension plans, success stories, "Awesome Lists" featuring. **None verifiable in this clone.** Only the CLI exists.
- ml-models.json exists but `accuracy: 0` — models are placeholders; ML scoring is functional code but with untrained weights.
- `fork-analyzer.ts` getForksDirect uses `fetch` (global) — works on Node 18+.

---

**Conclusion:** The codebase is a self-contained TypeScript CLI. Rebranding is feasible without functional changes. Git detachment is safe (no submodules, no nested repos). Proceed to Step B.
