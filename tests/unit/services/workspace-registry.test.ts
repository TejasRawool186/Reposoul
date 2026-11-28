/**
 * Tests for WorkspaceRegistry
 *
 * Uses a real temp directory for the registry file — no network calls.
 * All tests are isolated: each gets its own temp registry path.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { WorkspaceRegistry } from '../../../src/services/workspace-registry';
import type { CreateWorkspacePayload } from '../../../src/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tmpRegistryPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reposoul-reg-test-'));
  return path.join(dir, 'workspaces.json');
}

function makeRegistry(registryPath?: string): WorkspaceRegistry {
  return new WorkspaceRegistry(registryPath ?? tmpRegistryPath());
}

function makePayload(overrides: Partial<CreateWorkspacePayload> = {}): CreateWorkspacePayload {
  return {
    repository: 'owner/repo',
    workspacePath: path.join(os.tmpdir(), `ws-${Math.random().toString(36).slice(2)}`),
    hasClone: true,
    hasBlueprint: true,
    defaultBranch: 'main',
    headCommit: 'abc123def456',
    tags: [],
    statusNote: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WorkspaceRegistry', () => {

  // ─── list (empty) ──────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns empty array when registry file does not exist', () => {
      const reg = makeRegistry();
      expect(reg.list()).toEqual([]);
    });

    it('returns entries sorted most-recently-accessed first', () => {
      const reg = makeRegistry();
      const a = reg.register(makePayload({ repository: 'owner/repo-a' }));
      // Artificially set lastAccessedAt in the past for a
      reg.update(a.id, { lastAccessedAt: new Date(Date.now() - 60_000).toISOString() });
      const b = reg.register(makePayload({ repository: 'owner/repo-b' }));

      const list = reg.list();
      expect(list[0].id).toBe(b.id);
      expect(list[1].id).toBe(a.id);
    });
  });

  // ─── register ─────────────────────────────────────────────────────────────

  describe('register', () => {
    it('creates a new entry and returns it', () => {
      const reg = makeRegistry();
      const payload = makePayload();
      const entry = reg.register(payload);

      expect(entry.id).toBeTruthy();
      expect(entry.repository).toBe('owner/repo');
      expect(entry.hasClone).toBe(true);
      expect(entry.hasBlueprint).toBe(true);
      expect(entry.defaultBranch).toBe('main');
      expect(entry.headCommit).toBe('abc123def456');
      expect(entry.status).toBe('ready');
      expect(entry.tags).toEqual([]);
    });

    it('assigns a unique UUID to each entry', () => {
      const reg = makeRegistry();
      const a = reg.register(makePayload({ repository: 'owner/a' }));
      const b = reg.register(makePayload({ repository: 'owner/b' }));
      expect(a.id).not.toBe(b.id);
    });

    it('persists to disk — survives a new registry instance', () => {
      const registryPath = tmpRegistryPath();
      const reg1 = new WorkspaceRegistry(registryPath);
      const payload = makePayload({ repository: 'owner/persist-test' });
      const entry = reg1.register(payload);

      const reg2 = new WorkspaceRegistry(registryPath);
      const found = reg2.get(entry.id);
      expect(found).not.toBeNull();
      expect(found!.repository).toBe('owner/persist-test');
    });

    it('is idempotent for the same workspace path — returns updated entry', () => {
      const reg = makeRegistry();
      const payload = makePayload({ hasClone: false });
      const first = reg.register(payload);

      // Register same path again with updated metadata
      const second = reg.register({ ...payload, hasClone: true });

      // Should be the same id
      expect(second.id).toBe(first.id);
      expect(second.hasClone).toBe(true);
      // Only one entry in the list
      expect(reg.list().length).toBe(1);
    });

    it('creates the registry directory if it does not exist', () => {
      const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'reposoul-reg-nest-'));
      const nestedPath = path.join(tmpBase, 'deep', 'nested', 'workspaces.json');
      const reg = new WorkspaceRegistry(nestedPath);
      reg.register(makePayload());
      expect(fs.existsSync(nestedPath)).toBe(true);
    });

    it('sets createdAt to roughly now', () => {
      const reg = makeRegistry();
      const before = Date.now();
      const entry = reg.register(makePayload());
      const after = Date.now();
      const ts = new Date(entry.createdAt).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });

  // ─── get ──────────────────────────────────────────────────────────────────

  describe('get', () => {
    it('returns null for unknown id', () => {
      const reg = makeRegistry();
      expect(reg.get('nonexistent-uuid')).toBeNull();
    });

    it('returns the entry for a known id', () => {
      const reg = makeRegistry();
      const entry = reg.register(makePayload());
      expect(reg.get(entry.id)).not.toBeNull();
      expect(reg.get(entry.id)!.id).toBe(entry.id);
    });
  });

  // ─── findByRepository ─────────────────────────────────────────────────────

  describe('findByRepository', () => {
    it('returns null when no match', () => {
      const reg = makeRegistry();
      reg.register(makePayload({ repository: 'owner/other' }));
      expect(reg.findByRepository('owner/missing')).toBeNull();
    });

    it('finds by exact repository name', () => {
      const reg = makeRegistry();
      reg.register(makePayload({ repository: 'owner/my-repo' }));
      const found = reg.findByRepository('owner/my-repo');
      expect(found).not.toBeNull();
      expect(found!.repository).toBe('owner/my-repo');
    });

    it('is case-insensitive', () => {
      const reg = makeRegistry();
      reg.register(makePayload({ repository: 'Owner/My-Repo' }));
      expect(reg.findByRepository('owner/my-repo')).not.toBeNull();
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('returns null for unknown id', () => {
      const reg = makeRegistry();
      expect(reg.update('nonexistent', { status: 'error' })).toBeNull();
    });

    it('patches specified fields', () => {
      const reg = makeRegistry();
      const entry = reg.register(makePayload());
      const updated = reg.update(entry.id, { status: 'error', statusNote: 'Clone failed' });
      expect(updated!.status).toBe('error');
      expect(updated!.statusNote).toBe('Clone failed');
    });

    it('preserves id and createdAt', () => {
      const reg = makeRegistry();
      const entry = reg.register(makePayload());
      const updated = reg.update(entry.id, { status: 'error' });
      expect(updated!.id).toBe(entry.id);
      expect(updated!.createdAt).toBe(entry.createdAt);
    });

    it('updates lastAccessedAt when not specified', () => {
      const reg = makeRegistry();
      const entry = reg.register(makePayload());
      const before = new Date(entry.lastAccessedAt).getTime();
      // Small delay to ensure time difference
      const updated = reg.update(entry.id, { status: 'ready' });
      const after = new Date(updated!.lastAccessedAt).getTime();
      expect(after).toBeGreaterThanOrEqual(before);
    });

    it('persists patch across registry instances', () => {
      const registryPath = tmpRegistryPath();
      const reg1 = new WorkspaceRegistry(registryPath);
      const entry = reg1.register(makePayload());
      reg1.update(entry.id, { tags: ['important', 'revive'] });

      const reg2 = new WorkspaceRegistry(registryPath);
      expect(reg2.get(entry.id)!.tags).toEqual(['important', 'revive']);
    });
  });

  // ─── touch ────────────────────────────────────────────────────────────────

  describe('touch', () => {
    it('returns null for unknown id', () => {
      const reg = makeRegistry();
      expect(reg.touch('nonexistent')).toBeNull();
    });

    it('updates lastAccessedAt', () => {
      const reg = makeRegistry();
      const entry = reg.register(makePayload());
      // Set lastAccessedAt to the past
      reg.update(entry.id, { lastAccessedAt: new Date(Date.now() - 10_000).toISOString() });
      const before = new Date(reg.get(entry.id)!.lastAccessedAt).getTime();

      const touched = reg.touch(entry.id);
      const after = new Date(touched!.lastAccessedAt).getTime();
      expect(after).toBeGreaterThan(before);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('returns false for unknown id', () => {
      const reg = makeRegistry();
      expect(reg.remove('nonexistent')).toBe(false);
    });

    it('removes the entry and returns true', () => {
      const reg = makeRegistry();
      const entry = reg.register(makePayload());
      expect(reg.remove(entry.id)).toBe(true);
      expect(reg.get(entry.id)).toBeNull();
      expect(reg.list().length).toBe(0);
    });

    it('does not affect other entries', () => {
      const reg = makeRegistry();
      const a = reg.register(makePayload({ repository: 'owner/a' }));
      const b = reg.register(makePayload({ repository: 'owner/b' }));
      reg.remove(a.id);
      expect(reg.get(b.id)).not.toBeNull();
      expect(reg.list().length).toBe(1);
    });
  });

  // ─── reconcile ────────────────────────────────────────────────────────────

  describe('reconcile', () => {
    it('marks entries as missing when path does not exist', () => {
      const reg = makeRegistry();
      const entry = reg.register(makePayload({
        workspacePath: '/this/path/definitely/does/not/exist',
      }));
      reg.reconcile();
      expect(reg.get(entry.id)!.status).toBe('missing');
    });

    it('leaves entries intact when path exists', () => {
      const reg = makeRegistry();
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reposoul-reconcile-'));
      const entry = reg.register(makePayload({ workspacePath: tmpDir }));
      reg.reconcile();
      expect(reg.get(entry.id)!.status).toBe('ready');
      fs.rmdirSync(tmpDir);
    });
  });

  // ─── Corrupted file recovery ───────────────────────────────────────────────

  describe('corrupted registry file', () => {
    it('returns empty list when file contains invalid JSON', () => {
      const registryPath = tmpRegistryPath();
      fs.mkdirSync(path.dirname(registryPath), { recursive: true });
      fs.writeFileSync(registryPath, 'not valid json {{{{', 'utf-8');
      const reg = new WorkspaceRegistry(registryPath);
      expect(reg.list()).toEqual([]);
    });

    it('returns empty list when file contains non-array JSON', () => {
      const registryPath = tmpRegistryPath();
      fs.mkdirSync(path.dirname(registryPath), { recursive: true });
      fs.writeFileSync(registryPath, JSON.stringify({ not: 'an array' }), 'utf-8');
      const reg = new WorkspaceRegistry(registryPath);
      expect(reg.list()).toEqual([]);
    });

    it('recovers by writing a valid file on next register', () => {
      const registryPath = tmpRegistryPath();
      fs.mkdirSync(path.dirname(registryPath), { recursive: true });
      fs.writeFileSync(registryPath, 'corrupted', 'utf-8');
      const reg = new WorkspaceRegistry(registryPath);
      reg.register(makePayload());
      expect(reg.list().length).toBe(1);
    });
  });
});
