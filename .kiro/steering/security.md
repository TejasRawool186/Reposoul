# Security — REPOSOUL

## GitHub token protection

- Tokens live only in `.env` (git-ignored) or environment variables — never in code,
  logs, reports, or committed files
- `.env` is loaded from the current working directory, then the installation root;
  dotenv debug output is suppressed in the CLI to keep JSON output clean
- Minimum scope principle: `public_repo` unless private scanning is explicitly requested
- Token auto-detection (`gho_` prefix, length >100) exists; never log the token value
- If a token appears in any output or report, that is a bug — redact before release

## Local workspace boundaries

- REPOSOUL is read-only toward GitHub in Phase 1: it fetches, analyzes, and reports.
  It does not fork, open PRs, or write to any remote
- Any future write action (fork, PR automation) requires explicit human approval in the
  CLI flow and belongs to a later phase
- Workspace artifacts (blueprints, reports) must be written under the project directory
  only, never to system paths

## Safe subprocess handling

- Phase 1 spawns no subprocesses. If subprocess use is introduced later (validation
  runs, git operations), requirements:
  - No shell interpolation of untrusted input — always argument arrays, never string
    commands built from remote data (repository names, descriptions)
  - Timeouts on every spawned process
  - Validate/canonicalize any repository-derived path before use

## Human approval for external writes

- Any operation that mutates a remote resource (create fork, open PR, push branch,
  publish package) must be behind an explicit confirmation prompt and a feature flag
- `npm publish` requires owner sign-off (see DEPLOYMENT.md)

## Secrets redaction

- Redaction checklist before any report, log, or commit:
  - GitHub tokens (`ghp_`, `gho_`, `ghs_`, `v1.` prefixes)
  - `.env` contents
  - Any long opaque strings captured from API responses
- Phase reports in `reports/` must not contain tokens; scanner output that echoes repo
  metadata is fine, credentials are not

## Reporting vulnerabilities

Security issues in REPOSOUL itself should be reported privately to the project
maintainers, not via public issues (channel to be established with the first public
repository).
