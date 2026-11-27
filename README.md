# REPOSOUL

**Open Source Resurrection Workbench**

Give abandoned software a second life.

REPOSOUL is a command-line tool that helps developers discover abandoned open-source repositories, assess their technical and community condition, and plan their revival.

---

## Overview

Millions of open-source repositories go unmaintained each year. Projects that once solved real problems — with active communities, working codebases, and significant adoption — stop receiving updates and gradually become unusable. Finding which of these projects are worth reviving, and understanding the effort involved, is currently an unsystematic process.

REPOSOUL addresses this by providing:

- Automated discovery of abandoned repositories on GitHub
- Quantitative scoring for abandonment likelihood and revival feasibility
- Dependency health analysis across multiple languages and ecosystems
- Fork ecosystem analysis to identify active community continuations
- Machine learning-enhanced scoring when trained models are available
- Technical debt quantification for organizations and individual repositories

---

## Features

| Feature | Description | Status |
|---|---|---|
| Repository discovery | Search GitHub by language, stars, activity date, and category | Implemented |
| Abandonment scoring | 0–100 rule-based score derived from commit activity, issue metrics, and maintenance signals | Implemented |
| Revival potential | 0–100 feasibility score based on stars, forks, license, complexity, and language health | Implemented |
| Community analysis | Issue response time, contributor count, engagement metrics | Implemented |
| Dependency analysis | JavaScript/TypeScript (npm), Python (PyPI), Rust (crates.io), Go (proxy), Java (Maven) | Implemented |
| Fork analysis | Fork activity, divergence from origin, maintainer responsiveness | Implemented |
| Organization scanning | Per-organization scans with tech-debt cost, time, security, and business-impact metrics | Implemented |
| ML scoring layer | In-process linear and logistic regression, blended with rule-based scores | Implemented (models require training) |
| Output formats | Table, JSON, Markdown | Implemented |

---

## Prerequisites

- Node.js 18 or later
- npm 9 or later
- A GitHub personal access token (recommended — raises rate limit from 60 to 5,000 requests per hour)

---

## Installation

### From source

```bash
git clone https://github.com/TejasRawool186/Reposoul.git
cd Reposoul
npm install
npm run build
```

### Global installation (optional)

```bash
npm link
reposoul --version
```

---

## Configuration

### GitHub token

Create a token at [github.com/settings/tokens](https://github.com/settings/tokens).

Required scope:
- `public_repo` for public repository analysis
- `repo` for private repository scanning

Create a `.env` file in the project root:

```
GITHUB_TOKEN=your_token_here
```

REPOSOUL loads the token from the current working directory first, then from the installation root. The `.env` file is never committed — it is excluded by `.gitignore`.

For OAuth tokens (GitHub Apps, enterprise):

```
GITHUB_OAUTH_TOKEN=your_oauth_token_here
```

See [setup-token.md](setup-token.md) for detailed token configuration options.

---

## Usage

### Repository discovery

```bash
# Search for abandoned TypeScript repositories
reposoul hunt --language typescript --min-stars 100 --pushed-before 2022-01-01

# Filter by category
reposoul hunt --category cli-tool --min-stars 50 --pushed-before 2023-01-01 --limit 10

# Output as JSON
reposoul hunt --language rust --min-stars 200 --output json
```

### Single repository analysis

```bash
reposoul analyze owner/repository-name
reposoul analyze owner/repository-name --output markdown
reposoul analyze owner/repository-name --ml-enhanced
```

### Fork analysis

```bash
reposoul forks owner/repository-name --max-forks 20
reposoul forks owner/repository-name --sort activity --output markdown
```

### Organization scanning

```bash
reposoul scan your-organization --max-repos 50 --min-stars 100
reposoul scan your-organization --output markdown > report.md
reposoul scan-multi org1,org2,org3 --max-repos 20
```

### ML-enhanced scoring

```bash
# Train models first
reposoul train --sample-size 200

# Check model status
reposoul ml-info

# Use ML scoring
reposoul hunt --language typescript --ml-enhanced --ml-confidence 0.8
reposoul analyze owner/repo --ml-enhanced
```

### Utilities

```bash
# List supported languages for dependency analysis
reposoul languages

# Check GitHub API rate limit
reposoul rate-limit

# Help
reposoul --help
reposoul hunt --help
```

---

## Command reference

| Command | Purpose |
|---|---|
| `hunt` | Search GitHub for abandoned repositories |
| `analyze` | Analyze a single repository |
| `forks` | Analyze the fork ecosystem of a repository |
| `train` | Train ML models on repository data |
| `scan` | Scan all repositories for an organization or user |
| `scan-multi` | Compare multiple organizations |
| `languages` | List supported dependency-analysis languages |
| `ml-info` | Display ML model status and accuracy |
| `rate-limit` | Check GitHub API rate limit |

---

## Score interpretation

### Abandonment score (0–100)

| Range | Interpretation |
|---|---|
| 0–30 | Active — maintained project |
| 31–60 | At risk — showing signs of reduced activity |
| 61–80 | Likely abandoned |
| 81–100 | Definitively abandoned |

### Revival potential (0–100)

| Range | Interpretation |
|---|---|
| 0–30 | Poor candidate |
| 31–60 | Moderate potential |
| 61–80 | Good candidate |
| 81–100 | Strong revival opportunity |

---

## Architecture

```
src/
├── cli.ts                          Entry point — Commander CLI, all commands and formatters
├── reposoul.ts                     ReposoulHunter — orchestrates search, analysis, and ML
├── index.ts                        Library exports
├── types/
│   └── index.ts                    Shared interfaces and design tokens
└── services/
    ├── github.ts                   GitHub REST API client (axios)
    ├── analyzer.ts                 Rule-based repository scoring
    ├── dependency-analyzer.ts      npm dependency health and language dispatch
    ├── multi-language-analyzer.ts  Language detection and routing
    ├── fork-analyzer.ts            Fork ecosystem comparison
    ├── ml-trainer.ts               In-process ML training and model persistence
    ├── ml-predictor.ts             Model loading, prediction, and score blending
    ├── organization-scanner.ts     Organization scans and tech-debt metrics
    └── language-analyzers/
        ├── python-analyzer.ts      PyPI and OSV vulnerability data
        ├── rust-analyzer.ts        crates.io and RustSec
        ├── go-analyzer.ts          Go module proxy
        └── java-analyzer.ts        Maven Central
```

### Data flow

```
CLI input
  └─ ReposoulHunter
       ├─ GitHubService — search and fetch repository data
       ├─ RepositoryAnalyzer — scoring pipeline
       │    ├─ DependencyAnalyzer — dependency health
       │    └─ MLPredictor — optional ML enhancement
       └─ Output (table / JSON / Markdown)
```

---

## Technology stack

| Component | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Language | TypeScript 5.x (strict, CommonJS) |
| CLI framework | Commander 14 |
| HTTP client | Axios 1.21+ |
| Terminal output | Chalk 4, Ora 5 |
| Configuration | dotenv 16 |
| ML | In-process linear and logistic regression (no external service) |
| Test framework | Vitest 3.x |
| Linter | ESLint 9 with TypeScript ESLint |
| Formatter | Prettier 3 |

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode (ts-node, no build required)
npm run dev

# Type-check without emitting
npm run typecheck

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint

# Watch mode
npm run test:watch
```

### Project structure conventions

- One exported class per service file
- All shared TypeScript interfaces in `src/types/index.ts`
- Design tokens in `assets/theme-tokens.json` and `src/types/index.ts`
- Phase reports and audit documents in `reports/`
- Brand assets in `assets/`
- ML data in `data/`

---

## Testing

The project uses Vitest with V8 coverage. Run:

```bash
npm test                # single-pass run
npm run test:coverage   # with coverage report
```

Current coverage baseline: ~34% lines, ~62% branches, ~56% functions.

The test suite mocks all external API calls. No real GitHub credentials or network access are required to run tests.

---

## Roadmap

- [x] Repository discovery and scoring engine
- [x] Multi-language dependency analysis
- [x] Fork ecosystem analysis
- [x] ML scoring layer
- [x] Organization scanning with tech-debt metrics
- [x] Vitest test suite and GitHub Actions CI
- [ ] CLI command rename (discover, investigate)
- [ ] Revival blueprint generator
- [ ] REPOSOUL web dashboard
- [ ] Kiro IDE integration

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Before submitting a pull request:

1. Run `npm run build` — must pass with zero errors
2. Run `npm test` — all tests must pass
3. Run `npm run typecheck` — zero TypeScript errors
4. Add tests for new behavior

---

## License

MIT — see [LICENSE](LICENSE).
