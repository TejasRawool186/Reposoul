# Phase 4 — Live Workspace Monitoring

**Completed:** November 2026  
**Status:** Complete  
**Tests added:** 48 (377 total, up from 329)

---

## Overview

Phase 4 adds real-time filesystem monitoring to REPOSOUL workspaces. A chokidar-based
watcher emits typed events as files change inside a cloned workspace. An in-memory event
bus fans those events out to Server-Sent Event streams, letting any connected dashboard
page receive live updates without polling.

---

## New Services

### `src/services/workspace-monitor.ts` — `WorkspaceMonitorService`

Watches a workspace directory and exposes git status/diff snapshots.

| Method | Description |
|---|---|
| `start()` | Start chokidar watcher; throws if path missing; emits `monitor_started` |
| `stop()` | Flush pending debounced events, close watcher, emit `monitor_stopped` |
| `isWatching` | Boolean property |
| `getStatus()` | Point-in-time `WorkspaceStatusSnapshot` via simple-git |
| `getDiff()` | `WorkspaceDiff` with unified patch text (10 KB cap per file) |

**Default ignored patterns:** `node_modules`, `.git/objects`, `.git/refs`, `.git/logs`,
`dist`, `coverage`, `.next`, `*.log`.  
**Debounce:** 300 ms — file bursts are batched into one emission.  
**Degradation:** `getStatus()` and `getDiff()` return safe empty results when the repo
directory is absent or git fails.

### `src/services/workspace-events.ts` — `WorkspaceEventService`

In-process event bus with SSE delivery.

| Method | Description |
|---|---|
| `push(event)` | Buffer event + fan-out to all subscribers for that workspace |
| `getBuffer(workspaceId, sinceId?)` | Return buffered events, optionally since a given id |
| `createStream(workspaceId, lastEventId?)` | Return `ReadableStream<Uint8Array>` for SSE response |
| `attachMonitor(monitor, workspaceId)` | Forward monitor's `event` emissions into the bus |
| `detachMonitor(workspaceId)` | Stop + detach a monitor |
| `getMonitor(workspaceId)` | Retrieve the attached monitor |
| `subscriberCount(workspaceId)` | Count active SSE connections |
| `closeStreams(workspaceId)` | Close all SSE streams for a workspace |

**Buffer:** ring buffer of 100 events per workspace (oldest dropped when full).  
**SSE stream lifecycle:**
1. Sends `event: connected` immediately with subscriber metadata
2. Replays buffered events (or events since `lastEventId`)
3. Sends `: keepalive` comment every 20 s
4. Cleans up subscriber on stream cancellation

**Process-level singleton:** `globalEventService` — imported in API routes.

---

## New Types (`src/types/index.ts`)

| Type | Description |
|---|---|
| `WorkspaceEventType` | Union of 9 event kinds: file_added/changed/deleted/renamed, git_commit, git_branch_changed, monitor_started/stopped, error |
| `WorkspaceEvent` | id, workspaceId, type, path?, detail?, timestamp |
| `WorkspaceStatusSnapshot` | hasRepo, branch, HEAD, pendingChanges, statusLines, capturedAt |
| `DiffEntry` | path, status (modified/added/deleted/renamed/untracked), patch? |
| `WorkspaceDiff` | workspaceId, repoPath, entries, totalChanges, capturedAt |
| `MonitorOptions` | ignored[], debounceMs, ignoreInitial |

---

## New API Routes

| Route | Method | Description |
|---|---|---|
| `/api/workspaces/[id]/status` | GET | `WorkspaceStatusSnapshot` — git branch, HEAD, pending changes |
| `/api/workspaces/[id]/diff` | GET | `WorkspaceDiff` — changed files with unified patches. `?path=` filter |
| `/api/workspaces/[id]/events` | GET | SSE stream. `?autoStart=false` skips watcher start. Respects `Last-Event-ID` |

All three routes return 404 when the workspace id is not in the registry.  
`/status` and `/diff` touch `lastAccessedAt` via the registry.  
`/events` retrieves or creates a monitor, attaches it to `globalEventService`, and
starts it on first connection.

---

## Tests Added

| File | Tests | Coverage area |
|---|---|---|
| `tests/unit/services/workspace-monitor.test.ts` | 22 | isWatching, start/stop lifecycle+idempotence, chokidar handler registration, file event emission (bypassing debounce), getStatus (no repo, fake git, git error), getDiff (no repo, entries, patch, error), event shape |
| `tests/unit/services/workspace-events.test.ts` | 26 | push+getBuffer (buffer size, ring, isolation, sinceId), subscriberCount, createStream (ReadableStream instance, connected event, replay, fan-out, sinceId resume), closeStreams, attachMonitor (forwarding, idempotence), detachMonitor (removes monitor, calls stop) |

**Total tests: 377 (was 329 before Phase 4)**  
All 377 pass. No real filesystem watching or git operations in any test.

---

## Degradation Behaviour

| Failure | Behaviour |
|---|---|
| Workspace path missing at `start()` | Throws with descriptive error |
| chokidar watch error | Forwarded as `error` event on the monitor |
| `getStatus()` — no repo/ dir | Returns `hasRepo: false`, zero pending changes |
| `getStatus()` — git error | Returns `hasRepo: true`, null branch/commit, zero changes |
| `getDiff()` — no repo/ dir | Returns empty `WorkspaceDiff` |
| `getDiff()` — git error | Returns empty `WorkspaceDiff` |
| Monitor start failure on SSE connect | Logged as warning; stream still delivers buffered events |
| SSE subscriber closes connection | Stream cancel callback removes subscriber and clears keepalive timer |

---

## Security Notes

| Concern | Implementation |
|---|---|
| Path traversal in diff patches | Patches are raw git output scoped to the cloned `repo/` dir; `workspacePath` is `path.resolve()`'d |
| Patch size | Truncated to 10 KB per file — prevents oversized responses |
| Monitor secret | No external endpoint — events flow only through the in-process bus to same-origin SSE streams |
| chokidar symlinks | `followSymlinks: false` — prevents watching outside the workspace tree |
