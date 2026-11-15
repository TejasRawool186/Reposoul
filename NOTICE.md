# NOTICE

## REPOSOUL

REPOSOUL is an open-source resurrection workbench built using selected components from the
upstream project described below. This file fulfils the attribution requirements of the
upstream MIT License.

---

## Upstream project

| Field | Value |
|---|---|
| **Name** | Kraven |
| **Repository** | https://github.com/twansolo/kraven |
| **License** | MIT |
| **Copyright** | Copyright (c) 2025 Kraven Project |
| **Upstream HEAD at fork point** | `2d1c407963865a9ab6c7352c418e1d008ee7c555` (branch `main`) |

The upstream MIT License text is reproduced verbatim in the [LICENSE](LICENSE) file.

---

## Inherited components

The following components were inherited from the upstream Kraven project and are present
in this repository either unmodified or with REPOSOUL-specific modifications (branding,
naming, and project-identity changes):

| Component | Upstream path | REPOSOUL path | Modification |
|---|---|---|---|
| Core orchestrator class | `src/kraven.ts` | `src/reposoul.ts` | Renamed class `KravenHunter` → `ReposoulHunter`; updated comments |
| CLI entry point | `src/cli.ts` | `src/cli.ts` | Program name, descriptions, spinner text, and usage examples updated to REPOSOUL identity |
| Library exports | `src/index.ts` | `src/index.ts` | Import path and export updated for renamed class |
| Shared type definitions | `src/types/index.ts` | `src/types/index.ts` | Renamed `KravenConfig` → `ReposoulConfig`; REPOSOUL brand tokens appended |
| GitHub API client | `src/services/github.ts` | `src/services/github.ts` | User-Agent string updated |
| Repository analyzer | `src/services/analyzer.ts` | `src/services/analyzer.ts` | Unmodified except User-Agent propagation |
| Dependency analyzer | `src/services/dependency-analyzer.ts` | `src/services/dependency-analyzer.ts` | User-Agent strings updated |
| Multi-language analyzer | `src/services/multi-language-analyzer.ts` | `src/services/multi-language-analyzer.ts` | User-Agent strings updated |
| Fork analyzer | `src/services/fork-analyzer.ts` | `src/services/fork-analyzer.ts` | User-Agent string updated |
| ML trainer | `src/services/ml-trainer.ts` | `src/services/ml-trainer.ts` | User-Agent strings updated |
| ML predictor | `src/services/ml-predictor.ts` | `src/services/ml-predictor.ts` | Unmodified |
| Organization scanner | `src/services/organization-scanner.ts` | `src/services/organization-scanner.ts` | Unmodified |
| Python language analyzer | `src/services/language-analyzers/python-analyzer.ts` | same | Unmodified |
| Rust language analyzer | `src/services/language-analyzers/rust-analyzer.ts` | same | User-Agent string updated |
| Go language analyzer | `src/services/language-analyzers/go-analyzer.ts` | same | User-Agent string updated |
| Java language analyzer | `src/services/language-analyzers/java-analyzer.ts` | same | User-Agent string updated |
| ML model data | `data/ml-models.json` | `data/ml-models.json` | Unmodified |
| Training data | `data/training-data.json` | `data/training-data.json` | Unmodified |
| Sample repository list | `data/sample-repositories.txt` | `data/sample-repositories.txt` | Unmodified |
| TypeScript config | `tsconfig.json` | `tsconfig.json` | `moduleResolution` corrected from `bundler` to `node` (pre-existing upstream defect) |

---

## New work created for REPOSOUL

The following files are **not derived from the upstream project** and represent new work
created specifically for REPOSOUL:

- `assets/reposoul-logo.svg` — original phoenix-inspired brand mark
- `assets/reposoul-icon.svg` — icon-only logo variant
- `assets/favicon.svg` — favicon
- `assets/social-preview.svg` — OG/social-preview card
- `assets/theme-tokens.json` — REPOSOUL design token system
- `NOTICE.md` — this file
- `reports/PHASE_01_INITIAL_AUDIT.md` — Phase 1 audit
- `reports/PHASE_01_BRANDING_IMPLEMENTATION.md` — Phase 1 branding report
- `reports/PHASE_01_BRANDING_SCAN.md` — Phase 1 brand scan
- `reports/PHASE_01_VALIDATION_REPORT.md` — Phase 1 validation
- `reports/PHASE_01_COMPLETION_SUMMARY.md` — Phase 1 summary
- `.kiro/steering/product.md` and related steering documents
- Rewritten documentation: `README.md`, `CONTRIBUTING.md`, `DEPLOYMENT.md`,
  `GLOBAL_INSTALL.md`, `examples.md`, `setup-token.md`, `TECH-DEBT-METRICS.md`

---

## How to identify inherited components

Any file listed in the **Inherited components** table above originated from the upstream
Kraven project. The original Kraven source is publicly available under MIT at
https://github.com/twansolo/kraven.

For the upstream copyright notice see [LICENSE](LICENSE). That notice must be preserved
in all copies or substantial portions of the software, as required by the MIT License.

---

## Third-party dependencies

Runtime and development dependencies (listed in `package.json`) are third-party packages
with their own licenses. Install `license-checker` or similar tooling to audit them:

```bash
npx license-checker --summary
```

Key dependencies and their licenses at time of writing:

| Package | License |
|---|---|
| axios | MIT |
| chalk | MIT |
| commander | MIT |
| dotenv | BSD-2-Clause |
| ora | MIT |
| typescript | Apache-2.0 |
| ts-node | MIT |
| nodemon | MIT |

---

*REPOSOUL is not affiliated with or endorsed by the original Kraven project authors.*
