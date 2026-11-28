/**
 * Tests for WorkspaceMonitorService
 *
 * chokidar and simple-git are mocked — no real filesystem watching or git calls.
 * Real temp directories are used for path existence checks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { WorkspaceMonitorService } from '../../../src/services/workspace-monitor';

// ─── Mock chokidar ────────────────────────────────────────────────────────────

const mockWatcherOn    = vi.fn();
const mockWatcherClose = vi.fn().mockResolvedValue(undefined);
const mockWatch        = vi.fn();

vi.mock('chokidar', () => ({
  watch: mockWatch,
}));

function makeMockWatcher() {
  const watcher = {
    on:    mockWatcherOn,
    close: mockWatcherClose,
  };
  // .on() must be chainable
  mockWatcherOn.mockReturnValue(watcher);
  mockWatch.mockReturnValue(watcher);
  return watcher;
}

// ─── Mock simple-git ──────────────────────────────────────────────────────────

const mockStatus   = vi.fn();
const mockLog      = vi.fn();
const mockRevparse = vi.fn();
const mockDiff     = vi.fn();
const mockSimpleGit = vi.fn();

vi.mock('simple-git', () => ({
  simpleGit: mockSimpleGit,
}));

function makeGitMock(overrides: Partial<{
  status: any; log: any; revparse: any; diff: string;
}> = {}) {
  mockSimpleGit.mockReturnValue({
    status:   mockStatus,
    log:      mockLog,
    revparse: mockRevparse,
    diff:     mockDiff,
  });
  mockStatus.mockResolvedValue(overrides.status ?? {
    modified: [], not_added: [], created: [], deleted: [], renamed: [],
  });
  mockLog.mockResolvedValue(overrides.log ?? { latest: { hash: 'abc123' } });
  mockRevparse.mockResolvedValue(overrides.revparse ?? 'main\n');
  mockDiff.mockResolvedValue(overrides.diff ?? '');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'reposoul-mon-test-'));
}

function makeMonitor(wsPath: string, id = 'ws-123') {
  return new WorkspaceMonitorService(id, wsPath);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WorkspaceMonitorService', () => {
  let tempDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tempDir = makeTempDir();
  });

  afterEach(async () => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // ─── isWatching ────────────────────────────────────────────────────────────

  describe('isWatching', () => {
    it('is false before start()', () => {
      const monitor = makeMonitor(tempDir);
      expect(monitor.isWatching).toBe(false);
    });

    it('is true after start()', async () => {
      makeMockWatcher();
      const monitor = makeMonitor(tempDir);
      await monitor.start();
      expect(monitor.isWatching).toBe(true);
      await monitor.stop();
    });

    it('is false after stop()', async () => {
      makeMockWatcher();
      const monitor = makeMonitor(tempDir);
      await monitor.start();
      await monitor.stop();
      expect(monitor.isWatching).toBe(false);
    });
  });

  // ─── start() ───────────────────────────────────────────────────────────────

  describe('start()', () => {
    it('throws when workspace path does not exist', async () => {
      const monitor = makeMonitor('/path/that/does/not/exist');
      await expect(monitor.start()).rejects.toThrow('does not exist');
    });

    it('calls chokidar.watch with the workspace path', async () => {
      makeMockWatcher();
      const monitor = makeMonitor(tempDir);
      await monitor.start();
      expect(mockWatch).toHaveBeenCalledWith(
        expect.stringContaining(path.basename(tempDir)),
        expect.objectContaining({ persistent: true }),
      );
      await monitor.stop();
    });

    it('emits a monitor_started event', async () => {
      makeMockWatcher();
      const monitor = makeMonitor(tempDir);
      const events: any[] = [];
      monitor.on('event', e => events.push(e));

      await monitor.start();
      expect(events.some(e => e.type === 'monitor_started')).toBe(true);
      await monitor.stop();
    });

    it('is idempotent — calling start() twice does not create a second watcher', async () => {
      makeMockWatcher();
      const monitor = makeMonitor(tempDir);
      await monitor.start();
      await monitor.start(); // second call
      expect(mockWatch).toHaveBeenCalledTimes(1);
      await monitor.stop();
    });
  });

  // ─── stop() ────────────────────────────────────────────────────────────────

  describe('stop()', () => {
    it('closes the chokidar watcher', async () => {
      makeMockWatcher();
      const monitor = makeMonitor(tempDir);
      await monitor.start();
      await monitor.stop();
      expect(mockWatcherClose).toHaveBeenCalledOnce();
    });

    it('emits a monitor_stopped event', async () => {
      makeMockWatcher();
      const monitor = makeMonitor(tempDir);
      const events: any[] = [];
      monitor.on('event', e => events.push(e));

      await monitor.start();
      await monitor.stop();
      expect(events.some(e => e.type === 'monitor_stopped')).toBe(true);
    });

    it('is idempotent — stop() on a stopped monitor is a no-op', async () => {
      makeMockWatcher();
      const monitor = makeMonitor(tempDir);
      await monitor.start();
      await monitor.stop();
      await monitor.stop(); // second call — should not throw
      expect(mockWatcherClose).toHaveBeenCalledOnce();
    });
  });

  // ─── file events ───────────────────────────────────────────────────────────

  describe('file events', () => {
    it('registers add/change/unlink handlers on the watcher', async () => {
      makeMockWatcher();
      const monitor = makeMonitor(tempDir);
      await monitor.start();

      const registeredEvents = mockWatcherOn.mock.calls.map((c: any[]) => c[0]);
      expect(registeredEvents).toContain('add');
      expect(registeredEvents).toContain('change');
      expect(registeredEvents).toContain('unlink');
      await monitor.stop();
    });

    it('emits file_added event (bypassing debounce) via direct handler call', async () => {
      makeMockWatcher();
      const monitor = makeMonitor(tempDir, 'ws-event-test');
      const events: any[] = [];
      monitor.on('event', e => events.push(e));

      await monitor.start();

      // Find the 'add' handler and call it directly
      const addCall = mockWatcherOn.mock.calls.find((c: any[]) => c[0] === 'add');
      expect(addCall).toBeDefined();
      const addHandler = addCall![1] as (p: string) => void;

      await new Promise<void>(resolve => {
        monitor.once('event', e => {
          if (e.type === 'file_added') resolve();
        });
        addHandler(path.join(tempDir, 'src', 'index.ts'));
        // Flush debounce immediately by waiting slightly
        setTimeout(resolve, 400);
      });

      await monitor.stop();
    });
  });

  // ─── getStatus() ───────────────────────────────────────────────────────────

  describe('getStatus()', () => {
    it('returns hasRepo=false when repo/ directory does not exist', async () => {
      const monitor = makeMonitor(tempDir);
      const status = await monitor.getStatus();
      expect(status.hasRepo).toBe(false);
      expect(status.workspaceId).toBe('ws-123');
      expect(status.repoPath).toBeNull();
    });

    it('returns hasRepo=false when repo/ exists but has no .git', async () => {
      fs.mkdirSync(path.join(tempDir, 'repo'), { recursive: true });
      const monitor = makeMonitor(tempDir);
      const status = await monitor.getStatus();
      expect(status.hasRepo).toBe(false);
    });

    it('returns git data when repo/ has .git', async () => {
      // Create a fake git repo structure
      const repoDir = path.join(tempDir, 'repo');
      fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });

      makeGitMock({
        status: {
          modified: ['src/index.ts'],
          not_added: ['newfile.txt'],
          created: [],
          deleted: [],
          renamed: [],
        },
        log: { latest: { hash: 'deadbeef1234' } },
        revparse: 'main\n',
      });

      const monitor = makeMonitor(tempDir);
      const status = await monitor.getStatus();

      expect(status.hasRepo).toBe(true);
      expect(status.currentBranch).toBe('main');
      expect(status.headCommit).toBe('deadbeef1234');
      expect(status.pendingChanges).toBe(2);
      expect(status.statusLines.some((l: string) => l.includes('src/index.ts'))).toBe(true);
      expect(status.statusLines.some((l: string) => l.includes('newfile.txt'))).toBe(true);
    });

    it('returns capturedAt as an ISO timestamp', async () => {
      const monitor = makeMonitor(tempDir);
      const status = await monitor.getStatus();
      expect(() => new Date(status.capturedAt)).not.toThrow();
    });

    it('degrades gracefully when simple-git throws', async () => {
      const repoDir = path.join(tempDir, 'repo');
      fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });

      mockSimpleGit.mockReturnValue({
        status:   vi.fn().mockRejectedValue(new Error('git not found')),
        log:      vi.fn().mockRejectedValue(new Error('git not found')),
        revparse: vi.fn().mockRejectedValue(new Error('git not found')),
        diff:     vi.fn().mockRejectedValue(new Error('git not found')),
      });

      const monitor = makeMonitor(tempDir);
      const status = await monitor.getStatus();
      expect(status.hasRepo).toBe(true);
      expect(status.currentBranch).toBeNull();
      expect(status.pendingChanges).toBe(0);
    });
  });

  // ─── getDiff() ─────────────────────────────────────────────────────────────

  describe('getDiff()', () => {
    it('returns empty diff when repo/ does not exist', async () => {
      const monitor = makeMonitor(tempDir);
      const diff = await monitor.getDiff();
      expect(diff.entries).toEqual([]);
      expect(diff.totalChanges).toBe(0);
      expect(diff.repoPath).toBeNull();
    });

    it('returns diff entries for modified files', async () => {
      const repoDir = path.join(tempDir, 'repo');
      fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });

      makeGitMock({
        status: {
          modified: ['src/index.ts'],
          not_added: [],
          created: ['new.ts'],
          deleted: ['old.ts'],
          renamed: [],
        },
        diff: 'diff --git a/src/index.ts b/src/index.ts\n@@ -1 +1 @@\n-old\n+new\n',
      });

      const monitor = makeMonitor(tempDir);
      const diff = await monitor.getDiff();

      expect(diff.totalChanges).toBe(3);
      const modified = diff.entries.find((e: any) => e.path === 'src/index.ts');
      expect(modified?.status).toBe('modified');
      expect(diff.entries.find((e: any) => e.path === 'new.ts')?.status).toBe('added');
      expect(diff.entries.find((e: any) => e.path === 'old.ts')?.status).toBe('deleted');
    });

    it('attaches patch text to matching entries', async () => {
      const repoDir = path.join(tempDir, 'repo');
      fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });

      makeGitMock({
        status: { modified: ['README.md'], not_added: [], created: [], deleted: [], renamed: [] },
        diff: 'diff --git a/README.md b/README.md\n--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-old\n+new',
      });

      const monitor = makeMonitor(tempDir);
      const diff = await monitor.getDiff();
      const entry = diff.entries.find((e: any) => e.path === 'README.md');
      expect(entry?.patch).toBeTruthy();
    });

    it('degrades gracefully when simple-git throws', async () => {
      const repoDir = path.join(tempDir, 'repo');
      fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });

      mockSimpleGit.mockReturnValue({
        status: vi.fn().mockRejectedValue(new Error('git error')),
        diff:   vi.fn().mockRejectedValue(new Error('git error')),
      });

      const monitor = makeMonitor(tempDir);
      const diff = await monitor.getDiff();
      expect(diff.entries).toEqual([]);
      expect(diff.totalChanges).toBe(0);
    });
  });

  // ─── Event shape ───────────────────────────────────────────────────────────

  describe('event shape', () => {
    it('monitor_started event has required fields', async () => {
      makeMockWatcher();
      const monitor = makeMonitor(tempDir, 'shape-test');
      let event: any;
      monitor.once('event', e => { event = e; });

      await monitor.start();
      await monitor.stop();

      expect(event).toMatchObject({
        workspaceId: 'shape-test',
        type: 'monitor_started',
      });
      expect(typeof event.id).toBe('string');
      expect(typeof event.timestamp).toBe('string');
    });
  });
});
