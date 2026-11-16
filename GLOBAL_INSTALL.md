# REPOSOUL — Global Installation Guide

## Setup

```bash
# 1. Build the project
npm install
npm run build

# 2. Install the `reposoul` command globally on this machine
npm link
```

The `reposoul` command is now available from any directory.

## Usage from anywhere

```bash
# Discover abandoned TypeScript repositories from any directory
reposoul hunt --language typescript --min-stars 100 --limit 5

# Analyze a specific repository
reposoul analyze facebook/create-react-app

# Check API rate limit
reposoul rate-limit
```

## GitHub token

REPOSOUL automatically looks for your token in two places:

1. `.env` in the **current working directory** (project-specific)
2. `.env` in the **reposoul installation root** (global fallback)

For global use, put your token in the installation root:

```env
# d:\path\to\reposoul\.env
GITHUB_TOKEN=ghp_your_token_here
```

This gives you 5,000 API requests per hour instead of 60. See [setup-token.md](setup-token.md) for details.

## Updating after a source change

```bash
cd /path/to/reposoul
npm run build   # recompile; npm link persists
```

## Uninstalling

```bash
npm unlink reposoul
```

## Troubleshooting

| Problem | Solution |
|---|---|
| `reposoul: command not found` | Restart terminal; ensure npm global bin is in PATH |
| `Error: GitHub API Error: rate limit exceeded` | Add a GitHub token (see setup-token.md) |
| Build error after pulling changes | Delete `dist/`, then `npm run build` again |
