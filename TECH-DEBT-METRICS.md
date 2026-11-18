# Tech Debt Metrics — REPOSOUL

## Overview

REPOSOUL's organization scanning (`reposoul scan`) includes comprehensive tech-debt impact analysis, providing quantifiable metrics for cost, time, security risk, and business impact. These metrics help organizations make data-driven decisions about technical debt management.

*The metrics engine is inherited from the upstream Kraven project; see NOTICE.md for attribution.*

## Metrics categories

### Financial impact

- **Estimated annual cost** — based on repository health, maintenance requirements, and developer time. Approximation: `(poor_repos × $2,400) + (fair_repos × $1,200) + (critical_repos × $6,000)` annually. Purpose: budget planning.
- **Cost per repository (monthly)** — average monthly maintenance cost. Purpose: resource allocation.
- **Security incident risk cost** — `critical_repos × $50,000 × reputation_multiplier` (3× for >1000-star repos, 2× for >100-star, 1× otherwise). Purpose: risk assessment.
- **Opportunity cost** — lost productivity due to technical debt. Purpose: understanding hidden costs.

### Time investment required

- **Total maintenance hours** — critical repos: 16 h each; poor: 8 h; fair: 4 h; abandoned projects: 12 h.
- **Average hours per repository** — total hours ÷ repository count. Purpose: sprint planning.
- **Critical issue hours** — `critical_repos × 16 h`. Security vulnerabilities needing immediate attention.
- **Dependency update hours** — `(poor_repos × 8) + (fair_repos × 4) h`. Maintenance sprint planning.

### Security risk assessment

- **Overall risk score (0–100)** — weighted: critical repos 40%, poor repos 25%, abandoned projects 35%.
  - 0–20: low · 21–40: medium · 41–60: high · 61–80: very high · 81–100: critical
- **Vulnerability estimates** — critical: `critical_repos × 2.5`; high: `(poor + critical) × 1.8` (industry-average heuristics).
- **Outdated dependencies** — critical repos: ~25 each; poor: ~15; fair: ~8.
- **Compliance risk** — critical if >30% of repos have critical issues; high >15%; medium if >40% poor health; low otherwise.

### Business impact

- **Productivity loss (%)** — `min(50%, abandoned_projects_percentage)` — developer time spent on workarounds.
- **Deployment risk (0–100)** — `security_risk_score × 0.8` — production stability risk.
- **Talent retention (0–100)** — `max(0, 100 − productivity_loss × 1.5)` — high tech debt correlates with developer turnover.
- **Innovation delay (months)** — `(abandoned_projects / total_repos) × 12` — delayed feature development.

## Industry benchmarks used

- Developer hourly rate: $75
- Security specialist rate: $125
- DevOps hourly rate: $85
- Security incident cost: $50,000–$150,000 average
- Dependency update: 0.5–4 h per repo
- Complete revival: 1–4 weeks for abandoned projects

## Interpretation guide

| Level | Annual cost | Hours | Risk score | Productivity loss |
|---|---|---|---|---|
| Low | <$50K | <500 h | <30/100 | <10% |
| Medium | $50K–$200K | 500–2,000 h | 30–60/100 | 10–25% |
| High | $200K–$500K | 2,000–5,000 h | 60–80/100 | 25–40% |
| Critical | >$500K | >5,000 h | >80/100 | >40% |

## Action recommendations by risk level

- **Low (0–30)**: maintain current practices; monitor quarterly
- **Medium (31–60)**: create a remediation plan; prioritize critical repositories
- **High (61–80)**: immediate action; executive attention; dedicated sprint
- **Critical (81–100)**: emergency response; budget allocation; additional resources

## Using the metrics

- **CTOs / engineering leaders** — budget planning, risk management, team planning, strategic prioritization
- **Development teams** — sprint sizing, prioritization of high-risk repos, progress tracking
- **Security teams** — vulnerability prioritization, compliance reporting, incident planning

---

**Note**: These metrics are estimates based on industry research and should be calibrated to your organization's specific context, developer rates, and risk tolerance.
