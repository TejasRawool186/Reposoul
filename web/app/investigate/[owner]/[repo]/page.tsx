'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { Spinner } from '@/components/ui/Spinner';
import { useToken } from '@/lib/token-context';
import { analyzeRepository } from '@/lib/api';

type Tab = 'overview' | 'dependencies' | 'community';

function SeverityBadge({ value }: { value: string }) {
  const map: Record<string, 'error' | 'warning' | 'success' | 'muted'> = {
    critical: 'error', high: 'error', moderate: 'warning', low: 'muted', unknown: 'muted',
  };
  return <Badge variant={map[value] ?? 'muted'}>{value}</Badge>;
}

function MetricRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm text-text-primary font-medium">{value}</span>
    </div>
  );
}

export default function InvestigatePage() {
  const params = useParams();
  const owner = params.owner as string;
  const repo = params.repo as string;
  const fullName = `${owner}/${repo}`;

  const { token } = useToken();
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    setLoading(true);
    analyzeRepository(fullName, token)
      .then((data: any) => setAnalysis(data))
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, [fullName, token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Spinner size="lg" />
        <p className="text-text-muted text-sm">Analysing {fullName}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error/10 border border-error/30 rounded-lg p-6 text-center">
        <p className="text-error font-semibold mb-1">Analysis failed</p>
        <p className="text-sm text-text-secondary">{error}</p>
        <Link href="/" className="mt-4 inline-block text-sm text-primary hover:underline">Back to search</Link>
      </div>
    );
  }

  if (!analysis) return null;

  const a = analysis;
  const r = a.repository ?? {};
  const lastPushed = r.pushed_at ? new Date(r.pushed_at) : null;
  const ageYears = a.lastCommitAge ? (a.lastCommitAge / 365).toFixed(1) : '—';

  // Recommendation colour
  const recColor: Record<string, string> = {
    revive: 'text-success', fork: 'text-warning', monitor: 'text-primary', archive: 'text-error',
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="text-sm text-text-muted flex items-center gap-2">
        <Link href="/" className="hover:text-primary transition-colors">Discover</Link>
        <span>/</span>
        <span className="text-text-primary font-mono">{fullName}</span>
      </nav>

      {/* Header card */}
      <Card glow>
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-text-primary font-mono">{fullName}</h1>
              {r.archived && <Badge variant="warning">archived</Badge>}
              {r.language && <Badge variant="primary">{r.language}</Badge>}
            </div>
            {r.description && (
              <p className="text-sm text-text-secondary leading-relaxed mb-3">{r.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
              <span>⭐ {r.stargazers_count?.toLocaleString()}</span>
              <span>🍴 {r.forks_count?.toLocaleString()}</span>
              <span>{r.open_issues_count} open issues</span>
              {lastPushed && <span>Last active {ageYears}y ago</span>}
              {r.license && <span>{r.license.name}</span>}
            </div>
          </div>
          <div className="flex flex-col items-center sm:items-end gap-2">
            {a.scoringMethod && (
              <Badge variant="muted">{a.scoringMethod}</Badge>
            )}
            <Link href={`/blueprint/${owner}/${repo}`}>
              <Button size="sm" variant="primary">Generate Blueprint</Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Score rings */}
      <Card>
        <CardHeader>
          <CardTitle>Scores</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-6 justify-around">
          <ScoreRing value={a.abandonmentScore ?? 0} label="Abandonment" />
          <ScoreRing value={a.revivalPotential ?? 0} label="Revival Potential" />
          <ScoreRing value={a.communityEngagement ?? 0} label="Community" />
          <ScoreRing value={a.marketRelevance ?? 0} label="Market Relevance" />
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {(['overview', 'dependencies', 'community'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="grid gap-4 sm:grid-cols-2 animate-slide-up">
          <Card>
            <CardHeader><CardTitle>Repository metrics</CardTitle></CardHeader>
            <div>
              <MetricRow label="Stars" value={r.stargazers_count?.toLocaleString()} />
              <MetricRow label="Forks" value={r.forks_count?.toLocaleString()} />
              <MetricRow label="Open issues" value={r.open_issues_count} />
              <MetricRow label="Last commit age" value={`${a.lastCommitAge} days (${ageYears}y)`} />
              <MetricRow label="Technical complexity" value={
                <Badge variant={a.technicalComplexity === 'high' ? 'error' : a.technicalComplexity === 'medium' ? 'warning' : 'success'}>
                  {a.technicalComplexity}
                </Badge>
              } />
              <MetricRow label="Issue response time" value={
                a.issueResponseTime < 0 ? '—' : `${Math.round(a.issueResponseTime)} days avg`
              } />
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>Assessment</CardTitle></CardHeader>
            <div>
              {a.reasons?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-wider text-text-muted mb-2">Signals</p>
                  <ul className="space-y-1.5">
                    {a.reasons.map((r: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                        <span className="text-warning mt-0.5 shrink-0">▸</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {a.recommendations?.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-text-muted mb-2">Recommendations</p>
                  <ul className="space-y-1.5">
                    {a.recommendations.map((r: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                        <span className="text-primary mt-0.5 shrink-0">→</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Dependencies tab */}
      {tab === 'dependencies' && (
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle>Dependency Health</CardTitle>
            <CardDescription>
              Run <code className="font-mono text-primary">reposoul analyze {fullName} --output json</code> for full dependency data.
            </CardDescription>
          </CardHeader>
          <div className="text-center py-8 text-text-muted">
            <p className="mb-2">Detailed dependency analysis is available via CLI.</p>
            <Link href={`/blueprint/${owner}/${repo}`}>
              <Button variant="secondary" size="sm">View in Blueprint</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Community tab */}
      {tab === 'community' && (
        <Card className="animate-slide-up">
          <CardHeader><CardTitle>Community signals</CardTitle></CardHeader>
          <div>
            <MetricRow label="Engagement score" value={`${a.communityEngagement}/100`} />
            <MetricRow label="Market relevance" value={`${a.marketRelevance}/100`} />
            <MetricRow label="Stars" value={r.stargazers_count?.toLocaleString()} />
            <MetricRow label="Forks" value={r.forks_count?.toLocaleString()} />
            <MetricRow label="Issue response" value={a.issueResponseTime < 0 ? 'No data' : `${Math.round(a.issueResponseTime)} days`} />
            <MetricRow label="Watchers" value={r.watchers_count?.toLocaleString()} />
          </div>
        </Card>
      )}
    </div>
  );
}
