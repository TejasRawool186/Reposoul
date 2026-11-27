# Licensing and Attribution — REPOSOUL

## Upstream attribution (Kraven)

- **Upstream repository:** https://github.com/twansolo/kraven
- **Upstream license:** MIT — Copyright (c) 2025 Kraven Project
- **Upstream HEAD at fork point:** `2d1c407963865a9ab6c7352c418e1d008ee7c555`
- The full inherited-component inventory lives in [NOTICE.md](../../NOTICE.md) at the
  repository root. Keep it current whenever inherited files are renamed or added

## MIT license obligations

REPOSOUL is a derivative work of the upstream Kraven project. Under the MIT License,
the following must be preserved in all copies or substantial portions of the software:

1. The upstream copyright notice — reproduced verbatim in the root [LICENSE](../../LICENSE)
2. The MIT permission notice

Rules:

- **Never** edit the LICENSE file's upstream copyright line
- **Never** claim inherited code as newly authored
- New REPOSOUL-created files are listed as new work in NOTICE.md
- The package `license` field in `package.json` is `MIT` (corrected from an upstream
  `ISC` mismatch in Phase 1)

## Naming rules in code and docs

- Product/brand name: **REPOSOUL** (upstream name must not appear in active user-facing
  surfaces — CLI, help, output, UI)
- The upstream name **may and must** appear in: NOTICE.md, LICENSE (if referenced),
  attribution sections of README, and provenance documentation
- Any scan of the codebase that finds the upstream name in an active surface is a
  branding bug; in attribution contexts it is required

## Third-party code and assets

- Runtime/dev dependencies (axios, chalk, commander, dotenv, ora, typescript, ts-node,
  nodemon) carry their own licenses — audit with `npx license-checker --summary` before
  any publication
- The new REPOSOUL logo, icon, favicon, and social preview (`assets/*.svg`) are original
  works created for this project — no third-party marks are used
- Do not introduce third-party logos, fonts, or images without verifying usage rights
  and recording them in NOTICE.md

## License headers policy

Source files currently carry no per-file headers (upstream convention). If per-file
headers are introduced later, they must include the upstream copyright retention for
inherited files, not only REPOSOUL attribution.
