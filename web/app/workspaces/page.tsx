'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { useToken } from '@/lib/token-context';

interface WorkspaceEntry {
  id: string;
  repository: string;
  workspacePath: string;
  createdAt: string;
  lastAccessedAt: string;
  status: 'ready' | 'cloning' | 'error' | 'missing';
  statusNote: string | null;
  hasClone: boolean;
  hasBlueprint: boolean;
  defaultBranch: string | null;
  headCommit: string | null;
  tags: string[];
}

function statusColor(status: WorkspaceEntry['status']): string {
  switch (status) {
    case 'ready':   return 'text-success';
    case 'cloning': return 'text-warning';
    case 'error':   return 'text-error';
    case 'missing': return 'text-text-muted';
  }
}

function statusDot(status: WorkspaceEntry['status']): string {
  switch (status) {
    case 'ready':   return 'bg-success';
    case 'cloning': return 'bg-warning';
    case 'error':   return 'bg-error';
    case 'missing': return 'bg-text-muted';
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function WorkspacesPage() {
  const { token } = useToken();

  const [workspaces, setWorkspaces] = useState<WorkspaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openResult, setOpenResult] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/workspaces', {
        headers: { 'x-github-token': token },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load workspaces');
      setWorkspaces(data.workspaces ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  async function openWorkspace(id: string) {
    setOpeningId(id);
    setOpenResult(null);
    try {
      const res = await fetch(`/api/workspaces/${id}/open`, {
        method: 'POST',
        headers: { 'x-github-token': token },
      });
      const data = await res.json();
      if (res.ok) {
        setOpenResult({ id, msg: `Opened in ${data.editor ?? 'editor'}`, ok: true });
      } else {
        setOpenResult({ id, msg: data.error ?? 'Failed to open', ok: false });
      }
    } catch (err: any) {
      setOpenResult({ id, msg: err.message, ok: false });
    } finally {
      setOpeningId(null);
    }
  }

  async function deleteWorkspace(id: string) {
    if (!confirm('Remove this workspace from the registry? Files on disk are not deleted.')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/workspaces/${id}`, {
        method: 'DELETE',
        headers: { 'x-github-token': token },
      });
      if (res.ok) {
        setWorkspaces(ws => ws.filter(w => w.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Workspaces</h1>
          <p className="text-sm text-text-secondary mt-1">
            Repositories prepared for revival in Kiro IDE
          </p>
        </div>
        <Button onClick={fetchWorkspaces} disabled={loading} size="sm" variant="secondary">
          {loading ? <Spinner size="sm" /> : 'Refresh'}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-error/10 border border-error/30 rounded-lg p-4 text-sm text-error">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty state */}
      {!loading && workspaces.length === 0 && !error && (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <p className="text-4xl mb-4 select-none">🗂️</p>
          <p className="text-text-primary font-medium mb-1">No workspaces yet</p>
          <p className="text-sm text-text-secondary mb-6">
            Run <code className="bg-elevated px-1.5 py-0.5 rounded text-xs font-mono">reposoul workspace owner/repo</code> to prepare one
          </p>
          <Link href="/">
            <Button size="sm">Discover repositories</Button>
          </Link>
        </div>
      )}

      {/* Workspace list */}
      {!loading && workspaces.length > 0 && (
        <div className="flex flex-col gap-3">
          {workspaces.map(ws => (
            <div
              key={ws.id}
              className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors"
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full flex-shrink-0 ${statusDot(ws.status)}`}
                    />
                    <a
                      href={`https://github.com/${ws.repository}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-text-primary hover:text-primary transition-colors truncate"
                    >
                      {ws.repository}
                    </a>
                    <span className={`text-xs font-medium ${statusColor(ws.status)}`}>
                      {ws.status}
                    </span>
                  </div>

                  {/* Path */}
                  <p className="text-xs text-text-muted font-mono truncate pl-4">
                    {ws.workspacePath}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href={`/investigate/${ws.repository.split('/')[0]}/${ws.repository.split('/')[1]}`}>
                    <Button size="sm" variant="secondary">Analyze</Button>
                  </Link>
                  <Button
                    size="sm"
                    onClick={() => openWorkspace(ws.id)}
                    loading={openingId === ws.id}
                    disabled={ws.status === 'missing'}
                    title={ws.status === 'missing' ? 'Workspace directory not found on disk' : 'Open in Kiro IDE'}
                  >
                    Open in Kiro
                  </Button>
                  <button
                    onClick={() => deleteWorkspace(ws.id)}
                    disabled={deletingId === ws.id}
                    className="text-xs text-text-muted hover:text-error transition-colors px-1"
                    title="Remove from registry"
                  >
                    {deletingId === ws.id ? '…' : '✕'}
                  </button>
                </div>
              </div>

              {/* Open result feedback */}
              {openResult?.id === ws.id && (
                <p className={`text-xs px-4 ${openResult.ok ? 'text-success' : 'text-error'}`}>
                  {openResult.msg}
                </p>
              )}

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-3 pl-4 text-xs text-text-muted">
                {ws.hasClone && (
                  <span className="flex items-center gap-1">
                    <span className="text-success">✓</span> Cloned
                    {ws.defaultBranch && (
                      <span className="font-mono text-text-secondary ml-1">({ws.defaultBranch})</span>
                    )}
                  </span>
                )}
                {!ws.hasClone && (
                  <span className="text-text-muted">No clone</span>
                )}
                {ws.hasBlueprint && (
                  <span className="flex items-center gap-1">
                    <span className="text-success">✓</span> Blueprint
                  </span>
                )}
                {ws.headCommit && (
                  <span className="font-mono">{ws.headCommit.slice(0, 8)}</span>
                )}
                <span>Created {relativeTime(ws.createdAt)}</span>
                <span>Accessed {relativeTime(ws.lastAccessedAt)}</span>
              </div>

              {/* Status note (error details) */}
              {ws.statusNote && ws.status !== 'ready' && (
                <p className="text-xs text-error pl-4 leading-relaxed">
                  {ws.statusNote}
                </p>
              )}

              {/* Tags */}
              {ws.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pl-4">
                  {ws.tags.map(tag => (
                    <Badge key={tag} variant="default">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer hint */}
      {!loading && workspaces.length > 0 && (
        <p className="text-xs text-text-muted text-center pb-4">
          Removing a workspace only unregisters it. Files on disk are not deleted.
        </p>
      )}
    </div>
  );
}
