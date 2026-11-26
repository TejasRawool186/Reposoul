# Security Policy — REPOSOUL

## Supported versions

REPOSOUL is in active development. Security fixes are applied to the latest version only.

| Version | Supported |
|---|---|
| 1.0.x (current) | ✅ |
| < 1.0 | ❌ |

## Reporting a vulnerability

**Do not report security vulnerabilities via public GitHub issues.**

Report security issues privately:

1. Use [GitHub Private Security Advisories](https://github.com/TejasRawool186/REPOSOUL/security/advisories/new)
2. Or email the maintainer directly (address in the GitHub profile)

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

You should receive a response within 7 days.

## Security scope

REPOSOUL is a **read-only CLI tool** that:
- Fetches data from the GitHub REST API using a user-supplied PAT/OAuth token
- Fetches package metadata from public language registries (npm, PyPI, crates.io, Go proxy, Maven)
- Does not run user-supplied code
- Does not expose a network service or HTTP endpoint
- Does not store credentials beyond the local `.env` file

### In scope

- Token leakage through API calls, logs, or error messages
- SSRF via GitHub API proxy patterns
- Dependency vulnerabilities in production (`dependencies`, not `devDependencies`)
- Incorrect token scope validation
- Path traversal in file I/O operations

### Out of scope

- Vulnerabilities in `devDependencies` (test tooling, linters) that cannot be triggered by end-users
- Issues requiring a compromised developer machine
- Known issues documented in `reports/PHASE_02_SECURITY_AUDIT.md` (Vitest/tinypool dev-only advisory)

## Security best practices for users

1. Use a **minimum-scope GitHub token** (`public_repo` for public repos; `repo` only if private scanning is needed)
2. Store tokens in `.env` files only — never in source code
3. Keep the `.env` file out of version control (`.gitignore` excludes it by default)
4. Rotate tokens regularly at [github.com/settings/tokens](https://github.com/settings/tokens)
5. Never pass tokens on the command line in a shared shell environment (use `.env` instead)
