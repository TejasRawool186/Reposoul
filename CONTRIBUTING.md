# Contributing to REPOSOUL

Thank you for your interest in contributing to REPOSOUL — the Open Source Resurrection Workbench.

## 🎯 Ways to contribute

### 🐛 Bug reports

- Search existing issues before filing a new one
- Include steps to reproduce, expected vs actual behaviour, Node.js version, and OS
- Keep stack traces or CLI output

### 💡 Feature requests

- Describe the problem you are solving, not just the solution
- Keep scope tight — REPOSOUL follows a phased roadmap (see README)
- Phase 1 is rebranding only; feature requests for Phases 2–5 are tracked but not acted on yet

### 🔧 Code contributions

- Fork the repository, create a feature branch
- Follow the coding standards below
- Submit a pull request with a clear description

## 🛠️ Development setup

### Prerequisites

- Node.js 18+
- npm 9+
- TypeScript knowledge

### Local setup

```bash
git clone <your-fork>
cd reposoul
npm install
npm run build
npm link          # optional: make reposoul global on your machine
npm run dev       # run via ts-node without rebuilding
```

## 📐 Coding standards

### TypeScript

- Strict mode is enforced (`strict: true` in tsconfig.json)
- Prefer `interface` over `type` for object shapes
- Prefer `async/await` over raw promise chains
- JSDoc comments on exported functions and classes
- Match existing naming conventions — camelCase for variables/functions, PascalCase for classes and interfaces

### Code style

```typescript
// Good
interface RepositoryAnalysis {
  repository: GitHubRepository;
  abandonmentScore: number;
  revivalPotential: number;
}

async function analyzeRepository(repo: GitHubRepository): Promise<RepositoryAnalysis> {
  const analysis = await this.performAnalysis(repo);
  return analysis;
}
```

### Commit messages

Conventional commits:

```
feat: add dependency scanner for Kotlin/Gradle
fix: resolve rate-limit retry on 403 response
docs: update CLI usage examples in README
refactor: extract scoring logic into ScoringEngine class
test: add unit tests for abandonment-score calculation
```

### File naming

- Service classes: `kebab-case.ts` matching the class name
- Language analyzers: `<language>-analyzer.ts`
- Keep one exported class per file for services

## 🧪 Testing

**No test suite exists yet.** This is a known gap. The first priority for Phase 2 is establishing a test framework.

### Planned approach

- Unit tests: [Vitest](https://vitest.dev/) for scoring logic, parsers, and feature extraction
- Integration tests: GitHub API calls mocked with [MSW](https://mswjs.io/) or Axios adapter
- E2E: single CLI command run against a fixed known repository

If you want to help bootstrap the test suite, that is the most valuable Phase 2 contribution.

### Running tests

```bash
npm test    # currently: prints a note and exits 0
```

## 🌐 Branch strategy

- `main` — stable, buildable
- `feature/<name>` — new features
- `fix/<name>` — bug fixes
- `docs/<name>` — documentation-only changes

## 📬 Pull request process

1. Confirm the build passes: `npm run build`
2. Confirm no new branding regressions: `npm test`
3. Update relevant documentation if behaviour changes
4. Keep PRs focused — one concern per PR

### PR description template

```markdown
## What this changes
Brief explanation

## Why
Problem being solved

## Testing done
- [ ] `npm run build` passes
- [ ] Manual CLI test performed
- [ ] Docs updated if needed
```

## 📋 Project structure quick reference

```
src/
├── cli.ts                      # Commander CLI entry point
├── reposoul.ts                 # ReposoulHunter orchestrator
├── index.ts                    # Library exports
├── types/index.ts              # All shared types + brand tokens
└── services/
    ├── github.ts               # GitHub API client
    ├── analyzer.ts             # Repository scoring
    ├── dependency-analyzer.ts  # Dependency health
    ├── fork-analyzer.ts        # Fork ecosystem
    ├── ml-trainer.ts           # Model training
    ├── ml-predictor.ts         # Predictions
    ├── multi-language-analyzer.ts
    ├── organization-scanner.ts
    └── language-analyzers/     # python, rust, go, java
assets/                         # Brand assets, design tokens
data/                           # ML models and training data
```

## ⚖️ Licensing

REPOSOUL is MIT licensed. By contributing you agree your contributions are released under the same license. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).

## 🤝 Code of conduct

Be respectful, constructive, and professional. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
