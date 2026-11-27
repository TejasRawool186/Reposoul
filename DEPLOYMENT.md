# REPOSOUL — Deployment & Distribution Guide

This document covers how REPOSOUL is built, distributed, and (in future phases) deployed.

## Current distribution model

REPOSOUL is **not yet published to npm or any registry**. As of Phase 1 it is built and used locally:

```bash
# Build from source
npm install
npm run build

# Make the `reposoul` command available system-wide on your machine
npm link

# Verify
reposoul --help
```

To remove the global link later:

```bash
npm unlink reposoul
```

## Future: npm publication (Phase 2+)

The npm name `reposoul` was verified available at the time of writing (registry returns 404). Before a first publication:

1. Confirm with the project owners that publishing is intended
2. Populate `author` and (if created) `repository`/`homepage` fields in `package.json` with real URLs
3. Run a full clean build and CLI smoke test
4. Publish with `npm publish` (public access)

Do not publish until the Phase 2 test suite exists.

## Future: REPOSOUL Dashboard (Phase 4)

A web dashboard is planned but not yet implemented. When it exists, this section will cover static hosting, GitHub API token handling, CORS, and rate-limit strategy.

## Environment configuration

REPOSOUL loads a GitHub token from (in order):

1. A `.env` file in the current working directory
2. A `.env` file in the installation root (one level above `dist/`)

See [setup-token.md](setup-token.md) for token creation and scopes.

## Security notes for deployment

- ✅ Client-side only; no server component in Phase 1
- ✅ Tokens stay in local `.env` files (git-ignored) — never commit them
- ✅ Minimal scope principle: `public_repo` unless private scanning is needed
- ⚠️ If a dashboard is added later, tokens must never be proxied through a server

## Maintenance checklist

- [ ] `npm run build` passes with zero errors
- [ ] `reposoul --help` shows correct branding
- [ ] No `.env` files in the distribution
- [ ] `reports/` and local artifacts excluded from published package (via `.npmignore` when publishing)
