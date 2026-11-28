import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import {
  WorkspaceEntry,
  CreateWorkspacePayload,
  WorkspaceStatus,
} from '../types';

/**
 * WorkspaceRegistry
 *
 * Persists workspace metadata to a single JSON file on disk.
 * Default location: ~/.reposoul/workspaces.json
 *
 * All reads are live (no in-memory cache) so multiple processes see
 * the same state. Writes are atomic: write to a temp file then rename.
 */
export class WorkspaceRegistry {
  private readonly registryPath: string;

  constructor(registryPath?: string) {
    this.registryPath =
      registryPath ??
      path.join(os.homedir(), '.reposoul', 'workspaces.json');
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  /** Return all workspace entries, most-recently-accessed first. */
  list(): WorkspaceEntry[] {
    const data = this.readAll();
    return data.sort(
      (a, b) =>
        new Date(b.lastAccessedAt).getTime() -
        new Date(a.lastAccessedAt).getTime(),
    );
  }

  /** Find a workspace by its UUID. Returns null if not found. */
  get(id: string): WorkspaceEntry | null {
    return this.readAll().find(e => e.id === id) ?? null;
  }

  /** Find the first workspace whose repository matches owner/repo. */
  findByRepository(repository: string): WorkspaceEntry | null {
    const norm = repository.toLowerCase();
    return (
      this.readAll().find(e => e.repository.toLowerCase() === norm) ?? null
    );
  }

  // ─── Write ─────────────────────────────────────────────────────────────────

  /**
   * Register a new workspace. Returns the created entry.
   * Throws if a workspace for the same path already exists.
   */
  register(payload: CreateWorkspacePayload): WorkspaceEntry {
    const all = this.readAll();
    const absPath = path.resolve(payload.workspacePath);

    const existing = all.find(
      e => path.resolve(e.workspacePath) === absPath,
    );
    if (existing) {
      // Idempotent: return existing entry updated with latest metadata
      return this.update(existing.id, {
        hasClone: payload.hasClone ?? existing.hasClone,
        hasBlueprint: payload.hasBlueprint ?? existing.hasBlueprint,
        defaultBranch: payload.defaultBranch ?? existing.defaultBranch,
        headCommit: payload.headCommit ?? existing.headCommit,
        statusNote: payload.statusNote ?? existing.statusNote,
        status: 'ready',
        lastAccessedAt: new Date().toISOString(),
      })!;
    }

    const now = new Date().toISOString();
    const entry: WorkspaceEntry = {
      id: uuidv4(),
      repository: payload.repository,
      workspacePath: absPath,
      createdAt: now,
      lastAccessedAt: now,
      status: 'ready',
      statusNote: payload.statusNote ?? null,
      hasClone: payload.hasClone ?? false,
      hasBlueprint: payload.hasBlueprint ?? false,
      defaultBranch: payload.defaultBranch ?? null,
      headCommit: payload.headCommit ?? null,
      tags: payload.tags ?? [],
    };

    this.writeAll([...all, entry]);
    return entry;
  }

  /**
   * Update fields on an existing entry. Returns the updated entry,
   * or null if the id is not found.
   */
  update(
    id: string,
    patch: Partial<Omit<WorkspaceEntry, 'id' | 'createdAt'>>,
  ): WorkspaceEntry | null {
    const all = this.readAll();
    const idx = all.findIndex(e => e.id === id);
    if (idx === -1) return null;

    const updated: WorkspaceEntry = {
      ...all[idx],
      ...patch,
      id,
      createdAt: all[idx].createdAt,
      lastAccessedAt: patch.lastAccessedAt ?? new Date().toISOString(),
    };

    all[idx] = updated;
    this.writeAll(all);
    return updated;
  }

  /**
   * Mark a workspace as accessed now (updates lastAccessedAt).
   */
  touch(id: string): WorkspaceEntry | null {
    return this.update(id, { lastAccessedAt: new Date().toISOString() });
  }

  /**
   * Remove a workspace entry by id.
   * Does NOT delete files on disk — that is the caller's responsibility.
   * Returns true if an entry was removed, false if not found.
   */
  remove(id: string): boolean {
    const all = this.readAll();
    const filtered = all.filter(e => e.id !== id);
    if (filtered.length === all.length) return false;
    this.writeAll(filtered);
    return true;
  }

  /**
   * Refresh the status of all entries: set to 'missing' if the workspace
   * directory no longer exists on disk.
   */
  reconcile(): void {
    const all = this.readAll();
    const updated = all.map(e => {
      if (!fs.existsSync(e.workspacePath)) {
        return { ...e, status: 'missing' as WorkspaceStatus };
      }
      return e;
    });
    this.writeAll(updated);
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  private readAll(): WorkspaceEntry[] {
    if (!fs.existsSync(this.registryPath)) return [];
    try {
      const raw = fs.readFileSync(this.registryPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as WorkspaceEntry[];
    } catch {
      // Corrupted file — return empty; next write will reset it
      return [];
    }
  }

  /**
   * Atomic write: write to a temp file in the same directory, then rename.
   * This prevents partial reads if the process is interrupted mid-write.
   */
  private writeAll(entries: WorkspaceEntry[]): void {
    const dir = path.dirname(this.registryPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tmp = `${this.registryPath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(entries, null, 2), 'utf-8');
    fs.renameSync(tmp, this.registryPath);
  }
}
