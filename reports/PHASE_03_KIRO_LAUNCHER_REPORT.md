# Phase 3 — Kiro Launcher Integration

**Completed:** November 2026  
**Status:** Complete  
**Tests added:** 41 (329 total, up from 288)

---

## Overview

Phase 3 connects REPOSOUL workspaces to the Kiro IDE. It introduces a persistent
workspace registry, an editor detection and launch service, a full REST API for workspace
management, and a dashboard page for browsing and opening workspaces.

---

## New Services

### `src/services/workspace-registry.ts` — `WorkspaceRegistry`

Persists workspace metadata to `~/.reposoul/workspaces.json`.

| Method | Description |
|---|---|
| `list()` | All entries, most-recently-accessed first |
| `get(id)` | Single entry by UUID, or null |
| `findByRepository(repo)` | First match by owner/repo (case-insensitive) |
| `register(payload)` | Create new entry or upsert by path (idempotent) |
| `update(id, patch)` | Patch any field except id/createdAt |
| `touch(id)` | Update lastAccessedAt to now |
| `remove(id)` | Remove from registry (does not delete files) |
| `reconcile()` | Mark entries whose paths no longer exist as `missing` |

**Atomic writes:** temp file + rename prevents partial reads on crash.  
**Corruption recovery:** invalid JSON returns empty list; next write resets the file.

### `src/services/kiro-launcher.ts` — `KiroLauncherService`

Detects editor installations and opens a workspace directory in the best available one.

| Method | Description |
|---|---|
| `open(workspacePath)` | Canonicalise path, detect editors, launch best match |
| `detectEditors()` | Probe all candidate commands via `which`/`where` and known absolute paths |
| `isKiroInstalled()` | Fast boolean check |

**Editor preference order:** Kiro IDE → VS Code → VS Code Insiders → VSCodium.  
**Platform coverage:** Windows (AppData paths), macOS (Applications), Linux (snap).  
**Security:** `workspacePath` is `path.resolve()`'d and existence-checked before use.
All subprocess calls use argument arrays — no shell string interpolation.  
**Timeout:** 10 s hard limit on every subprocess call.

---

## New Types (`src/types/index.ts`)

| Type | Description |
|---|---|
| `WorkspaceStatus` | `ready` \| `cloning` \| `error` \| `missing` |
| `WorkspaceEntry` | Full registry record — id, repository, path, status, clone/blueprint flags, branch, commit, tags |
| `CreateWorkspacePayload` | Input for `register()` |
| `LaunchResult` | Editor launch outcome — success, editor name, path, error |
| `EditorInstallation` | Detected editor record — name, command, resolved path, isKiro flag |

---

## New API Routes (web dashboard)

| Route | Methods | Description |
|---|---|---|
| `/api/workspaces` | GET, POST | List all workspaces (with reconcile); register a new one |
| `/api/workspaces/[id]` | GET, PATCH, DELETE | Single workspace: fetch, update status/tags/statusNote, remove |
| `/api/workspaces/[id]/open` | GET, POST | GET probes installed editors; POST launches the workspace |

All routes use the `createRequire` pattern loading from `dist/` — consistent with
existing API routes.

---

## Dashboard Changes

### New page: `/workspaces`

- Lists all registered workspaces from the registry
- **Status indicator:** colour-coded dot (green=ready, amber=cloning, red=error, grey=missing)
- **Open in Kiro** button — calls `POST /api/workspaces/[id]/open`, shows inline feedback
- **Analyze** link — navigates to `/investigate/owner/repo`
- **Remove** button — calls `DELETE /api/workspaces/[id]`, removes from list instantly
- **Meta row:** clone status, blueprint status, default branch, HEAD commit (8 chars), relative timestamps
- **Status note:** shown when status is not `ready` (e.g. clone error message)
- **Tags:** displayed as badges
- **Empty state:** explains how to create a workspace via CLI
- **Refresh** button: re-fetches and reconciles

### Updated: `Header.tsx`

Added two navigation links: **AI Search** (`/discover`) and **Workspaces** (`/workspaces`).

---

## CLI Changes

### `workspace` command

Both `prepare()` and `prepareNoClone()` paths now call `WorkspaceRegistry.register()`
after creating workspace files. The registry entry captures:
- `repository`, `workspacePath`
- `hasClone` (true/false from clone result)
- `hasBlueprint` (always true after prepare)
- `defaultBranch`, `headCommit` (from clone metadata)
- `statusNote` (clone error message, if any)

The registry file is created on first use at `~/.reposoul/workspaces.json`.

---

## Tests Added

| File | Tests | Coverage area |
|---|---|---|
| `tests/unit/services/workspace-registry.test.ts` | 28 | list, register (idempotent, persists, creates dirs), get, findByRepository (case-insensitive), update (fields, timestamps, persists), touch, remove, reconcile (missing/present paths), corrupted file recovery |
| `tests/unit/services/kiro-launcher.test.ts` | 13 | open (missing path, no editor, successful launch, ENOENT), detectEditors (shape, Kiro first), isKiroInstalled, LaunchResult shape, path resolution |

**Total tests: 329 (was 288 before Phase 3)**  
All 329 pass. All subprocess and child_process calls are mocked.

---

## Security Notes

| Concern | Implementation |
|---|---|
| Path traversal in `open()` | `path.resolve()` + `fs.existsSync()` before any subprocess call |
| Shell injection in launch | `execFile` with argument array — workspace path is never string-interpolated |
| Shell injection in detection | `which`/`where` called with `[command]` array argument |
| Registry path tampering | Registry path is canonicalised with `path.resolve()` on read |
| Token in registry | Registry stores no credentials — workspace path and metadata only |

---

## Degradation Behaviour

| Failure | Behaviour |
|---|---|
| Registry file missing | Returns empty list; created on first write |
| Registry file corrupted | Returns empty list; overwritten on next register |
| Kiro not installed | Falls back to VS Code; if none found, returns clear error |
| Workspace path missing on disk | `reconcile()` marks it `missing`; Open in Kiro button disabled |
| Editor launch non-zero exit | Treated as success (editors fork themselves immediately) |
| Editor launch ENOENT | Treated as failure with descriptive error |
