'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface Repo {
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string;
  archived: boolean;
  license: { name: string } | null;
}

interface RepoCardProps { repo: Repo; }

function timeAgo(date: string): string {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${(days / 365).toFixed(1)}y ago`;
}

export function RepoCard({ repo }: RepoCardProps) {
  const [owner, name] = repo.full_name.split('/');
  const staleDays = Math.floor((Date.now() - new Date(repo.pushed_at).getTime()) / 86400000);
  const staleVariant = staleDays > 730 ? 'error' : staleDays > 365 ? 'warning' : 'success';

  return (
    <Card className="hover:border-primary/40 transition-colors group">
      <div className="flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/investigate/${owner}/${name}`}
              className="font-semibold text-text-primary group-hover:text-primary transition-colors text-sm truncate block"
            >
              {repo.full_name}
            </Link>
            {repo.description && (
              <p className="text-xs text-text-secondary mt-0.5 line-clamp-2 leading-relaxed">{repo.description}</p>
            )}
          </div>
          {repo.archived && <Badge variant="warning">archived</Badge>}
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          {repo.language && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary opacity-80" />
              {repo.language}
            </span>
          )}
          <span>⭐ {repo.stargazers_count.toLocaleString()}</span>
          <span>🍴 {repo.forks_count.toLocaleString()}</span>
          <Badge variant={staleVariant}>
            {timeAgo(repo.pushed_at)}
          </Badge>
          {repo.license && <span>{repo.license.name}</span>}
        </div>

        {/* Action row */}
        <div className="flex gap-2 pt-1">
          <Link
            href={`/investigate/${owner}/${name}`}
            className="text-xs px-3 py-1 rounded border border-border hover:border-primary/50 hover:text-primary text-text-secondary transition-colors"
          >
            Investigate
          </Link>
          <Link
            href={`/blueprint/${owner}/${name}`}
            className="text-xs px-3 py-1 rounded border border-border hover:border-primary/50 hover:text-primary text-text-secondary transition-colors"
          >
            Blueprint
          </Link>
        </div>
      </div>
    </Card>
  );
}
