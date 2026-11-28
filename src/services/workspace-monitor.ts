import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  WorkspaceEvent,
  WorkspaceEventType,
  WorkspaceStatusSnapshot,
  WorkspaceDiff,
  DiffEntry,
  MonitorOptions,
} from '../types';

// chokidar is loaded dynamically to keep startup fast and allow mocking in tests
type ChokidarWatcher = {
  on(event: string, handler: (...args: any[]) => void): ChokidarWatcher;
  close(): Promise<void>;
};

/** Default glob patterns to ignore when watching a workspace */
const DEFAULT_IGNORED = [
  '**/node_modules/**',
  '**/.git/objects/**',
  '**/.git/refs/**',
  '**/.git/logs/**',
  '**/dist/**',
  '**/coverage/**',
  '**/.next/**',
  '**/*.log',
];

/**
 * WorkspaceMonitorService
 *
 * Watches a workspace directory for filesystem changes and emits typed
 * WorkspaceEvents. Uses chokidar for cross-platform fs watching.
 *
 * Usage:
 *   const monitor = new WorkspaceMonitorService('ws-uuid', '/path/to/workspace');
 *   monitor.on('event', (e: WorkspaceEvent) => { ... });
 *   await monitor.start();
 *   // ...
 *   await monitor.stop();
 */
export class WorkspaceMonitorService extends EventEmitter {
  private readonly workspaceId: string;
  private readonly workspacePath: string;
  private readonly repoPath: string;
  private readonly options: Required<MonitorOptions>;

  private watcher: ChokidarWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingEvents: WorkspaceEvent[] = [];
  private _isWatching = false;

  constructor(
    workspaceId: string,
    workspacePath: string,
    options: MonitorOptions = {},
  ) {
    super();
    this.workspaceId = workspaceId;
    this.workspacePath = path.resolve(workspacePath);
    this.repoPath = path.join(this.workspacePath, 'repo');
    this.options = {
      ignored: options.ignored ?? DEFAULT_IGNORED,
      debounceMs: options.debounceMs ?? 300,
      ignoreInitial: options.ignoreInitial ?? true,
    };
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  get isWatching(): boolean {
    return this._isWatching;
  }

  /**
   * Start watching the workspace directory.
   * Emits a 'monitor_started' event immediately.
   * Throws if the workspace path does not exist.
   */
  async start(): Promise<void> {
    if (this._isWatching) return;

    if (!fs.existsSync(this.workspacePath)) {
      throw new Error(
        `Workspace path does not exist: ${this.workspacePath}`,
      );
    }

    const { watch } = await import('chokidar');

    this.watcher = watch(this.workspacePath, {
      ignored: this.options.ignored,
      persistent: true,
      ignoreInitial: this.options.ignoreInitial,
      followSymlinks: false,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    }) as ChokidarWatcher;

    this.watcher
      .on('add',    (filePath: string) => this.queue('file_added',   filePath))
      .on('change', (filePath: string) => this.queue('file_changed', filePath))
      .on('unlink', (filePath: string) => this.queue('file_deleted', filePath))
      .on('error',  (err: Error)       => this.emit('error', err));

    this._isWatching = true;
    this.emit('event', this.makeEvent('monitor_started'));
  }

  /**
   * Stop the watcher and flush any pending events.
   */
  async stop(): Promise<void> {
    if (!this._isWatching) return;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
      this.flush();
    }

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    this._isWatching = false;
    this.emit('event', this.makeEvent('monitor_stopped'));
  }

  /**
   * Capture a point-in-time status snapshot of the workspace using
   * simple-git. Falls back gracefully if git is not available.
   */
  async getStatus(): Promise<WorkspaceStatusSnapshot> {
    const hasRepo = fs.existsSync(this.repoPath) &&
                    fs.existsSync(path.join(this.repoPath, '.git'));

    if (!hasRepo) {
      return {
        workspaceId: this.workspaceId,
        workspacePath: this.workspacePath,
        repoPath: null,
        hasRepo: false,
        currentBranch: null,
        headCommit: null,
        pendingChanges: 0,
        statusLines: [],
        capturedAt: new Date().toISOString(),
      };
    }

    try {
      const { simpleGit } = await import('simple-git');
      const git = simpleGit(this.repoPath, { timeout: { block: 10_000 } });

      const [statusResult, logResult, branchResult] = await Promise.allSettled([
        git.status(),
        git.log(['-1']),
        git.revparse(['--abbrev-ref', 'HEAD']),
      ]);

      const status = statusResult.status === 'fulfilled' ? statusResult.value : null;
      const log    = logResult.status    === 'fulfilled' ? logResult.value    : null;
      const branch = branchResult.status === 'fulfilled' ? branchResult.value : null;

      const statusLines: string[] = [];
      if (status) {
        for (const f of status.modified)  statusLines.push(` M ${f}`);
        for (const f of status.not_added) statusLines.push(`?? ${f}`);
        for (const f of status.created)   statusLines.push(` A ${f}`);
        for (const f of status.deleted)   statusLines.push(` D ${f}`);
      }

      return {
        workspaceId: this.workspaceId,
        workspacePath: this.workspacePath,
        repoPath: this.repoPath,
        hasRepo: true,
        currentBranch: branch?.trim() ?? null,
        headCommit: log?.latest?.hash ?? null,
        pendingChanges: statusLines.length,
        statusLines,
        capturedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        workspaceId: this.workspaceId,
        workspacePath: this.workspacePath,
        repoPath: this.repoPath,
        hasRepo: true,
        currentBranch: null,
        headCommit: null,
        pendingChanges: 0,
        statusLines: [],
        capturedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Compute a diff of uncommitted changes in the cloned repo.
   * Patches are truncated to 10 KB each to keep responses manageable.
   */
  async getDiff(): Promise<WorkspaceDiff> {
    const hasRepo = fs.existsSync(this.repoPath) &&
                    fs.existsSync(path.join(this.repoPath, '.git'));

    if (!hasRepo) {
      return {
        workspaceId: this.workspaceId,
        repoPath: null,
        entries: [],
        totalChanges: 0,
        capturedAt: new Date().toISOString(),
      };
    }

    try {
      const { simpleGit } = await import('simple-git');
      const git = simpleGit(this.repoPath, { timeout: { block: 15_000 } });

      const [statusResult, diffResult] = await Promise.allSettled([
        git.status(),
        git.diff(['--unified=3']),
      ]);

      const status = statusResult.status === 'fulfilled' ? statusResult.value : null;
      const rawDiff = diffResult.status === 'fulfilled' ? diffResult.value : '';

      const entries: DiffEntry[] = [];

      if (status) {
        for (const f of status.modified)  entries.push({ path: f, status: 'modified' });
        for (const f of status.created)   entries.push({ path: f, status: 'added' });
        for (const f of status.deleted)   entries.push({ path: f, status: 'deleted' });
        for (const f of status.renamed)   entries.push({ path: f.to ?? String(f), status: 'renamed' });
        for (const f of status.not_added) entries.push({ path: f, status: 'untracked' });
      }

      // Attach patch snippets from the unified diff
      if (rawDiff) {
        const MAX_PATCH = 10 * 1024; // 10 KB per file
        const fileDiffs = rawDiff.split(/^diff --git /m).filter(Boolean);
        for (const chunk of fileDiffs) {
          const match = chunk.match(/^a\/(.+?) b\//);
          if (!match) continue;
          const filePath = match[1];
          const entry = entries.find(e => e.path === filePath);
          if (entry) {
            entry.patch = chunk.length > MAX_PATCH
              ? chunk.slice(0, MAX_PATCH) + '\n… (truncated)'
              : chunk;
          }
        }
      }

      return {
        workspaceId: this.workspaceId,
        repoPath: this.repoPath,
        entries,
        totalChanges: entries.length,
        capturedAt: new Date().toISOString(),
      };
    } catch {
      return {
        workspaceId: this.workspaceId,
        repoPath: this.repoPath,
        entries: [],
        totalChanges: 0,
        capturedAt: new Date().toISOString(),
      };
    }
  }

  // ─── Event helpers ─────────────────────────────────────────────────────────

  private makeEvent(
    type: WorkspaceEventType,
    filePath?: string,
    detail?: string,
  ): WorkspaceEvent {
    return {
      id: uuidv4(),
      workspaceId: this.workspaceId,
      type,
      path: filePath
        ? path.relative(this.workspacePath, filePath)
        : undefined,
      detail,
      timestamp: new Date().toISOString(),
    };
  }

  private queue(type: WorkspaceEventType, filePath: string): void {
    this.pendingEvents.push(this.makeEvent(type, filePath));

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.flush(), this.options.debounceMs);
  }

  private flush(): void {
    const batch = this.pendingEvents.splice(0);
    for (const event of batch) {
      this.emit('event', event);
    }
  }
}
