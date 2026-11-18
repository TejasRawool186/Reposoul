# REPOSOUL — Usage Examples

## Basic discovery

### Search for abandoned TypeScript projects
```bash
reposoul hunt --language typescript --min-stars 100 --pushed-before 2022-01-01
```

### Find abandoned CLI tools
```bash
reposoul hunt --category cli-tool --min-stars 50 --max-stars 1000 --pushed-before 2023-01-01
```

### Search JavaScript build tools
```bash
reposoul hunt --language javascript --category build-tool --min-stars 200
```

## Advanced searches

### Projects with active issues but no maintenance
```bash
reposoul hunt --language typescript --min-stars 100 --pushed-before 2021-01-01 --limit 10
```

### Search for specific time ranges
```bash
reposoul hunt --language javascript --pushed-after 2020-01-01 --pushed-before 2022-01-01
```

## Analysis commands

### Analyze a specific repository
```bash
reposoul analyze facebook/create-react-app
reposoul analyze microsoft/vscode
```

### Generate a markdown report
```bash
reposoul analyze owner/repo --output markdown > analysis.md
```

### Export JSON data
```bash
reposoul hunt --language typescript --output json > results.json
```

## Fork analysis

### Analyze forks of an abandoned repository
```bash
reposoul forks bower/bower --max-forks 10 --min-stars 5
```

### Sort by different criteria
```bash
reposoul forks angular/angular.js --max-forks 20 --sort activity
reposoul forks jquery/jquery-ui --sort health --output markdown
```

### Find the most active fork
```bash
reposoul forks facebook/create-react-app --sort stars --max-forks 15
```

## Machine learning commands

### Train ML models
```bash
reposoul train --sample-size 100 --popular-repos
```

### Train with a custom repository list
```bash
reposoul train --repositories my-repos.txt
```

### Check ML model status
```bash
reposoul ml-info
```

### ML-enhanced discovery and analysis
```bash
reposoul hunt --language typescript --ml-enhanced --ml-confidence 0.8
reposoul analyze microsoft/typescript --ml-enhanced
```

## Organization scanning

### Scan an organization (includes tech-debt metrics)
```bash
reposoul scan microsoft --max-repos 20 --min-stars 100
```

### Generate a full tech-debt markdown report
```bash
reposoul scan netflix --max-repos 50 --min-stars 200 --output markdown > netflix-report.md
```

### Scan a user account
```bash
reposoul scan torvalds --max-repos 10 --exclude-forks
```

### Multi-organization comparison
```bash
reposoul scan-multi microsoft,google,facebook --max-repos 15
```

### Language-specific organization scan
```bash
reposoul scan netflix --languages javascript,typescript --max-repos 25
```

## Private repository scanning

Private scanning requires a GitHub token with `repo` scope (not just `public_repo`).

```bash
# Hunt private repositories
reposoul hunt --language typescript --include-private --min-stars 1

# Scan an organization's private repos
reposoul scan your-org --include-private --max-repos 20
```

See [setup-token.md](setup-token.md) for token scope details.

## OAuth token examples

```bash
# Specify OAuth token on command line
reposoul hunt --oauth-token "gho_xxxxxxxxxxxx" --language javascript --include-private

# Or via environment variable (recommended)
export GITHUB_OAUTH_TOKEN="gho_xxxxxxxxxxxx"
reposoul scan myorg --include-private --max-repos 30
```

## Utility commands

```bash
# Check GitHub API rate limits
reposoul rate-limit

# Show supported dependency-analysis languages
reposoul languages
```

## Interpreting results

### Abandonment score (0–100%)
- 0–30%: Active project
- 31–60%: Showing signs of abandonment
- 61–80%: Likely abandoned
- 81–100%: Definitely abandoned

### Revival potential (0–100%)
- 0–30%: Poor candidate
- 31–60%: Moderate potential
- 61–80%: Good candidate
- 81–100%: Excellent revival opportunity

### Status indicators
- **PRIME**: High abandonment + high revival potential
- **MAYBE**: Moderate scores — investigate further
- **SKIP**: Low revival potential or still active

### ML prediction indicators
- **High confidence (>80%)**: ML scores are reliable
- **Medium confidence (60–80%)**: Use alongside rule-based score
- **Low confidence (<60%)**: Fall back to rule-based scoring
- **No ML**: Models not trained yet — run `reposoul train`

## Tips for success

1. Start broad — use general searches first, then narrow filters
2. Check forks — popular abandoned projects often have more active forks
3. Train ML models for better scoring (`reposoul train`)
4. Consider licensing before forking — ensure you can maintain the project
5. Export results to JSON for downstream analysis or dashboards
