# Product — REPOSOUL

## Identity

- **Name:** REPOSOUL
- **Category:** Open Source Resurrection Workbench
- **Tagline:** Give abandoned software a second life.
- **Description:** An AI-powered open-source resurrection workbench that helps developers discover abandoned repositories, investigate their technical condition, generate revival blueprints and work with Kiro IDE to rebuild and validate projects.
- **Direction:** REPOSOUL Dashboard + Kiro IDE
- **Context:** Kiroween 2026 — Resurrection category

## Mission

Close the gap between abandoned open-source software and the developers willing to revive
it. REPOSOUL makes discovery, investigation and revival-planning systematic instead of
accidental, and connects the resulting plan to an execution environment (Kiro IDE).

## Principles

1. **Honesty in output** — never present unimplemented features as working; scores and
   reports must be verifiable
2. **Preserve provenance** — upstream attribution (Kraven, MIT) is maintained in NOTICE.md
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

## Current scope (Phase 1)

Rebranding, project identity, Git detachment, documentation, attribution and validation
only. No new product features. The working CLI (`hunt`, `analyze`, `forks`, `train`,
`scan`, `scan-multi`, `languages`, `ml-info`, `rate-limit`) is the shipped feature set.

## Future command surface (proposed, not implemented)

```
reposoul discover      # replaces hunt
reposoul investigate   # replaces analyze
reposoul blueprint     # new (Phase 3)
reposoul workspace     # new (Phase 5)
reposoul validate      # new (Phase 5)
reposoul report        # new (Phase 3)
```

Do not implement these until their phase begins.
