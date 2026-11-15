<div align="center">

  <img src="assets/reposoul-logo.svg" alt="REPOSOUL logo — a rising phoenix in ember orange" width="180" height="180">

  # REPOSOUL

  **Give abandoned software a second life.**

  An AI-powered open-source resurrection workbench

  [![License: MIT](https://img.shields.io/badge/License-MIT-F97316.svg)](LICENSE)
  [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

</div>

---

## 🧭 What is REPOSOUL?

REPOSOUL is an **Open Source Resurrection Workbench**. It helps developers discover abandoned open-source repositories, understand their technical and community condition, and plan their revival — with a longer-term goal of using Kiro IDE to rebuild and validate revived projects.

**Built for Kiroween 2026 — Resurrection category.**

REPOSOUL is a new project built using selected components from the upstream open-source project [Kraven](https://github.com/twansolo/kraven) (MIT). Full attribution is in [NOTICE.md](NOTICE.md).

## 📌 Problem statement

Millions of open-source repositories are abandoned every year — projects that solved real problems, accumulated communities, and then went quiet. Developers who want to revive them have no systematic way to:

- **Discover** which abandoned projects are worth reviving
- **Investigate** their technical condition (dependency rot, security debt, community signals)
- **Plan** a revival effort with realistic effort and success estimates
- **Execute** the revival with modern tooling

REPOSOUL exists to close that gap.

## ✅ What REPOSOUL currently does (implemented and verified)

REPOSOUL is currently a **TypeScript CLI tool**. These capabilities are inherited, rebranded and verified in this codebase:

| Capability | Description | Status |
|---|---|---|
| Repository discovery | Search GitHub for abandoned repositories by language, category, stars, and push-date | ✅ Implemented |
| Abandonment scoring | 0–100% rule-based abandonment likelihood | ✅ Implemented |
| Revival potential | 0–100% rule-based feasibility score | ✅ Implemented |
| Dependency analysis | Multi-language: JavaScript/TypeScript (npm), Python (PyPI), Rust (crates.io), Go (proxy), Java (Maven) | ✅ Implemented |
| Fork analysis | Fork activity, divergence, and maintainer responsiveness | ✅ Implemented |
| Organization scanning | Per-org scans with tech-debt cost/time/security metrics | ✅ Implemented |
| ML scoring layer | Linear/logistic regression models trained in-process, blended with rule-based scores | ⚙️ Implemented, ships with untrained placeholder models |
| Output formats | Table, JSON, and Markdown | ✅ Implemented |
| Auth | GitHub PAT and OAuth tokens with auto-detection | ✅ Implemented |

> **Note:** The ML layer is fully wired, but the bundled `data/ml-models.json` ships with `accuracy: 0` placeholder weights. Run `reposoul train` to train real models before relying on ML-enhanced scores.

## 🚧 In progress

- Rebranding and project foundation (this phase)
- Test suite (none exists yet — see [CONTRIBUTING.md](CONTRIBUTING.md))

## 🗺️ Planned (not yet implemented)

- `reposoul discover` / `investigate` / `blueprint` / `workspace` / `validate` / `report` — the future command surface
- **REPOSOUL Dashboard** — a web frontend
- AI-driven revival blueprints
- Kiro IDE integration (agent orchestration, MCP server) — see the Kiro vision below
- Automated validation of revived projects

None of the planned features above are functional today.

## 🏛️ Current architecture

```
src/
├── cli.ts                  # Commander CLI: hunt, analyze, forks, train, scan, scan-multi, languages, ml-info, rate-limit
├── reposoul.ts             # ReposoulHunter orchestration class
├── index.ts                # Library exports
├── types/index.ts          # Shared types + REPOSOUL brand/color tokens
└── services/
    ├── github.ts           # GitHub API client (search, repos, issues, commits, auth)
    ├── analyzer.ts         # Rule-based abandonment/revival scoring
    ├── dependency-analyzer.ts      # npm deps + multi-language dispatch
    ├── multi-language-analyzer.ts  # Language detection + dispatch
    ├── fork-analyzer.ts           # Fork ecosystem analysis
    ├── ml-trainer.ts / ml-predictor.ts  # ML training + prediction
    ├── organization-scanner.ts     # Org scans, tech-debt metrics
    └── language-analyzers/         # python, rust, go, java
```

Data artifacts live in `data/` (ML models and training data). Brand assets and design tokens live in `assets/`.

## 🛠️ Technology stack

- **TypeScript** (strict, CommonJS, compiled with `tsc`)
- **Node.js** 18+
- **Commander** (CLI), **Chalk** + **Ora** (terminal UX)
- **Axios** (GitHub REST API)
- **In-process ML** (linear/logistic regression — no external ML service)

## 📦 Installation

```bash
# From this repository (not yet published to npm)
npm install
npm run build

# Optional: make the `reposoul` command global on your machine
npm link
```

### 🔑 GitHub token (recommended)

A token raises your API rate limit from 60 to 5,000 requests/hour:

1. Create a token at [github.com/settings/tokens](https://github.com/settings/tokens)
2. Scope: `public_repo` (or `repo` for private-repository scanning)
3. Put it in a `.env` file in the project root:

```env
GITHUB_TOKEN=ghp_your_token_here
```

Detailed setup: [setup-token.md](setup-token.md)

## 🧑‍💻 Development

```bash
npm install
npm run build     # compile TypeScript → dist/
npm run dev       # run CLI via ts-node
npm test          # no test suite yet (see CONTRIBUTING.md)
```

## ⌨️ CLI usage (verified commands)

```bash
# Discover abandoned TypeScript repositories
reposoul hunt --language typescript --min-stars 100 --pushed-before 2022-01-01

# Analyze a specific repository
reposoul analyze owner/repository-name

# Analyze the fork ecosystem of an abandoned project
reposoul forks bower/bower --max-forks 10

# Scan an organization (includes tech-debt cost metrics)
reposoul scan microsoft --max-repos 20 --min-stars 100

# Compare multiple organizations
reposoul scan-multi microsoft,google,facebook --max-repos 15

# Train ML models, then use ML-enhanced scoring
reposoul train --sample-size 200
reposoul hunt --language typescript --ml-enhanced --ml-confidence 0.8

# Utilities
reposoul languages    # supported dependency-analysis languages
reposoul ml-info      # ML model status
reposoul rate-limit   # GitHub API rate limit
```

Output formats: `--output table|json|markdown` on `hunt`, `analyze`, `forks`, and `scan`.

Full command examples: [examples.md](examples.md)

## 📸 Screenshots

*(Placeholders — screenshots to be captured)*

| CLI output | Status |
|---|---|
| `reposoul hunt` table results | 📷 TODO |
| `reposoul analyze` detailed report | 📷 TODO |
| `reposoul scan` organization report | 📷 TODO |

## 🔭 Product vision: REPOSOUL + Kiro IDE

The end state is a two-part workflow:

1. **REPOSOUL Dashboard** — discover, investigate, and triage abandoned repositories; generate a revival blueprint (scope, effort, dependencies, risks).
2. **Kiro IDE** — consume the blueprint and drive the actual revival: specs, tasks, agent-assisted code repair, and validation.

This integration is **planned, not implemented**. Phase 1 (this release) is rebranding and project identity only.

## 🗓️ Roadmap

- [x] Phase 1 — Rebranding, Git detachment, attribution, Kiro project foundation
- [ ] Phase 2 — Test suite, CLI command surface rename (`discover`, `investigate`, …)
- [ ] Phase 3 — Revival blueprint generator
- [ ] Phase 4 — REPOSOUL Dashboard web frontend
- [ ] Phase 5 — Kiro IDE integration (agents, MCP, validation workflows)

## 🤝 Contributing

Contributions are welcome — read [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

MIT — see [LICENSE](LICENSE). This project includes code derived from the upstream Kraven project; attribution in [NOTICE.md](NOTICE.md).

## 🙏 Upstream attribution

REPOSOUL is built on selected components from [Kraven](https://github.com/twansolo/kraven) by its original authors, used under the MIT license. See [NOTICE.md](NOTICE.md) for inherited-component details.
