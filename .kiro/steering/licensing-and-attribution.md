# Licensing and Attribution

## MIT License

REPOSOUL is released under the MIT License. The full license text is in the root
[LICENSE](../../LICENSE) file.

## Third-party attribution

The [LICENSE](../../LICENSE) file contains a copyright notice that must be preserved in
all copies or substantial portions of the software, as required by the MIT License.
Do not remove or modify the copyright line in that file.

The [NOTICE.md](../../NOTICE.md) file documents additional attribution details. It must
be kept current and must not be deleted.

## Package license field

`package.json` carries `"license": "MIT"`. This must not be changed.

## Third-party code and assets

- Runtime and development dependencies carry their own licenses. Audit with
  `npx license-checker --summary` before any publication.
- Brand assets in `assets/` (SVG logos, theme tokens) are original works for REPOSOUL.
  No third-party marks or logos are used.
- Do not introduce third-party logos, fonts, or images without verifying usage rights
  and updating NOTICE.md.

## Naming rules

- Product name: **REPOSOUL** — use consistently across all surfaces.
- Do not introduce alternative names or aliases in user-facing documentation.

## License headers policy

Source files do not carry per-file headers (project convention). If per-file headers
are introduced, include the copyright notice from LICENSE to satisfy the MIT requirement
for derived files.
