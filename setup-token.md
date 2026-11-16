# GitHub Authentication Setup for REPOSOUL

REPOSOUL supports both **Personal Access Tokens (PAT)** and **OAuth tokens**.

## Why you need a token

Without a token: 60 GitHub API requests per hour.
With a token: 5,000 requests per hour.

A token is not required, but analysis will hit rate limits very quickly without one.

## Method 1: Personal Access Token (recommended for individuals)

### Step 1 — Create a token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Name it (e.g. `REPOSOUL`)
4. Set expiration (90 days recommended)
5. Select scope:
   - `public_repo` — for public repository analysis (most users)
   - `repo` — for private repository scanning (see below)
6. Click **Generate token** and copy it

### Step 2 — Add to .env

Create a `.env` file in the REPOSOUL project root:

```env
GITHUB_TOKEN=ghp_your_token_here
```

The `.env` file is git-ignored; it will not be committed.

### Step 3 — Verify

```bash
reposoul rate-limit
```

Expected with token: `Remaining: XXXX/5000`

## Method 2: OAuth token

For GitHub Apps, enterprise OAuth flows, or CI/CD pipelines:

```bash
# Option A: dedicated environment variable
echo "GITHUB_OAUTH_TOKEN=gho_xxxxxxxxxxxx" >> .env

# Option B: CLI flag
reposoul hunt --oauth-token "gho_xxxxxxxxxxxx" --language typescript

# Option C: type hint (auto-detected for gho_ prefix)
reposoul hunt --token "gho_xxxxxxxxxxxx" --token-type oauth
```

## Token priority order

REPOSOUL checks authentication in this order:

1. `--oauth-token` CLI flag
2. `--token` CLI flag
3. `GITHUB_OAUTH_TOKEN` environment variable
4. `GITHUB_TOKEN` with `GITHUB_TOKEN_TYPE=oauth`
5. `GITHUB_TOKEN` (treated as PAT)

## Scope reference

| Scope | Public repos | Private repos |
|---|---|---|
| `public_repo` | Yes | No |
| `repo` | Yes | Yes |

## Private repository scanning

Requires a token with `repo` scope:

```bash
reposoul hunt --include-private --language typescript
reposoul scan your-org --include-private --max-repos 20
```

## Security notes

- Never commit your `.env` file (it is in `.gitignore` by default)
- Use the minimum required scope (`public_repo` unless you need private access)
- Revoke tokens at [github.com/settings/tokens](https://github.com/settings/tokens) if compromised
- Tokens with `repo` scope grant full repository access — treat them as passwords
