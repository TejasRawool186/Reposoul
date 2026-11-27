# Product — REPOSOUL

## Identity

- **Name:** REPOSOUL
- **Category:** Open Source Resurrection Workbench
- **Tagline:** Give abandoned software a second life.
- **Description:** An AI-powered open-source resurrection workbench that helps developers discover abandoned repositories, investigate their technical condition, generate revival blueprints and work with Kiro IDE to rebuild and validate projects.
- **Direction:** REPOSOUL Dashboard + Kiro IDE

## Mission

Close the gap between abandoned open-source software and the developers willing to revive
it. REPOSOUL makes discovery, investigation and revival-planning systematic instead of
accidental, and connects the resulting plan to an execution environment (Kiro IDE).

## Principles

1. **Honesty in output** — never present unimplemented features as working; scores and
   reports must be verifiable
2. **Attribution integrity** — third-party license notices are preserved as required by law
3. **Dark-first, premium** — the visual identity is a phoenix rising from ember
   (tokens in `assets/theme-tokens.json` and `src/types/index.ts`)
4. **Data-driven** — every score (abandonment, revival, tech debt) must trace to a metric
5. **Developer-respect** — fast CLI, clean JSON output, minimal magic

## User journey (target end state)

1. **Discover** — search and filter abandoned repositories (implemented: `hunt`)
2. **Investigate** — analyze technical condition, dependencies, forks, community
   (implemented: `analyze`, `forks`, `scan`)
3. **Blueprint** — generate a structured revival plan (planned)
4. **Workspace** — prepare a Kiro IDE workspace from a blueprint (planned)
5. **Validate** — rebuild and verify the revived project (planned)

## Current scope (Phase 3)

Fully functional CLI with 11 commands, Vitest test suite, GitHub Actions CI, ESLint, and
security-audited dependencies. The shipped feature set now includes the revival blueprint
generator (`blueprint`, `report`) in addition to the Phase 2 commands.

**All implemented CLI commands:**
`hunt`, `analyze`, `forks`, `train`, `scan`, `scan-multi`, `languages`, `ml-info`,
`rate-limit`, `blueprint`, `report`

## Future command surface (proposed, not implemented)

```
reposoul blueprint     # implemented (Phase 3)
reposoul report        # implemented (Phase 3)
reposoul discover      # replaces hunt (Phase 4+)
reposoul investigate   # replaces analyze (Phase 4+)
reposoul workspace     # new (Phase 5)
reposoul validate      # new (Phase 5)
```

Do not implement these until their phase begins.
