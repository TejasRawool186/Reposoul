'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { useToken } from '@/lib/token-context';
import { generateBlueprint } from '@/lib/api';

type Severity = 'critical' | 'high' | 'medium' | 'low';
type Priority = 1 | 2 | 3 | 4 | 5;
type Recommendation = 'revive' | 'fork' | 'archive' | 'monitor';

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, 'error' | 'warning' | 'success' | 'muted'> = {
    critical: 'error', high: 'error', medium: 'warning', low: 'muted',
  };
  return <Badge variant={map[severity] ?? 'muted'}>{severity}</Badge>;
}

function PriorityDot({ priority }: { priority: number }) {
  const colors = ['', 'bg-error', 'bg-warning', 'bg-primary', 'bg-text-muted', 'bg-text-muted'];
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${colors[priority]} shrink-0 mt-1.5`} title={`Priority ${priority}`} />
  );
}

function RecBanner({ rec }: { rec: Recommendation }) {
  const config: Record<Recommendation, { label: string; color: string; bg: string; border: string; desc: string }> = {
    revive:  { label: 'REVIVE',  color: '#22C55E', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)',   desc: 'Strong candidate for active revival.' },
    fork:    { label: 'FORK',    color: '#EAB308', bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.3)',   desc: 'Consider forking and restarting under active maintainership.' },
    monitor: { label: 'MONITOR', color: '#F97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)',  desc: 'Still shows activity. Monitor before committing resources.' },
    archive: { label: 'ARCHIVE', color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   desc: 'Low revival potential. Not recommended for active investment.' },
  };
  const c = config[rec] ?? config.monitor;
  return (
    <div className="rounded-lg p-4 flex items-center gap-3" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <span className="text-2xl font-bold" style={{ color: c.color }}>{c.label}</span>
      <p className="text-sm text-text-secondary">{c.desc}</p>
    </div>
  );
}

export default function BlueprintPage() {
  const params = useParams();
  const owner = params.owner as string;
  const repo = params.repo as string;
  const fullName = `${owner}/${repo}`;

  const { token } = useToken();
  const [blueprint, setBlueprint] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    generateBlueprint(fullName, token)
      .then((data: any) => setBlueprint(data))
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, [fullName, token]);

  function toggleCheck(id: string) {
    setCheckedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Spinner size="lg" />
        <p className="text-text-muted text-sm">Generating revival blueprint for {fullName}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error/10 border border-error/30 rounded-lg p-6 text-center">
        <p className="text-error font-semibold mb-1">Blueprint generation failed</p>
        <p className="text-sm text-text-secondary">{error}</p>
        <Link href="/" className="mt-4 inline-block text-sm text-primary hover:underline">Back to search</Link>
      </div>
    );
  }

  if (!blueprint) return null;

  const bp = blueprint;
  const effort = bp.effortEstimate ?? {};
  const doneCount = checkedItems.size;
  const totalActions = bp.actionItems?.length ?? 0;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="text-sm text-text-muted flex items-center gap-2">
        <Link href="/" className="hover:text-primary transition-colors">Discover</Link>
        <span>/</span>
        <Link href={`/investigate/${owner}/${repo}`} className="hover:text-primary transition-colors font-mono">{fullName}</Link>
        <span>/</span>
        <span className="text-text-primary">Blueprint</span>
      </nav>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-xl font-bold text-text-primary">Revival Blueprint</h1>
          <span className="text-text-muted font-mono text-sm">/{fullName}</span>
        </div>
        <p className="text-xs text-text-muted">
          Generated {new Date(bp.generatedAt).toLocaleString()} · Confidence: <span className="text-text-secondary">{bp.confidence}</span>
        </p>
      </div>

      {/* Recommendation banner */}
      <RecBanner rec={bp.recommendation} />

      {/* Score summary + effort */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Scores</CardTitle></CardHeader>
          <div className="flex flex-wrap gap-4 justify-around py-2">
            <ScoreRing value={bp.overallScore ?? 0} label="Overall" size={72} />
            <ScoreRing value={bp.scores?.revivalPotential ?? 0} label="Revival" size={72} />
            <ScoreRing value={bp.scores?.communityEngagement ?? 0} label="Community" size={72} />
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Effort estimate</CardTitle></CardHeader>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Duration</span>
              <span className="text-text-primary font-semibold">{effort.minDays}–{effort.maxDays} working days</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Team size</span>
              <span className="text-text-primary">{effort.teamSize} developer{effort.teamSize > 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Complexity</span>
              <Badge variant={effort.complexity === 'high' || effort.complexity === 'very-high' ? 'error' : effort.complexity === 'medium' ? 'warning' : 'success'}>
                {effort.complexity}
              </Badge>
            </div>
            {effort.factors?.slice(0, 3).map((f: string, i: number) => (
              <p key={i} className="text-xs text-text-muted pl-1 border-l border-border">{f}</p>
            ))}
          </div>
        </Card>
      </div>

      {/* Executive summary */}
      {bp.executiveSummary && (
        <Card>
          <CardHeader><CardTitle>Executive Summary</CardTitle></CardHeader>
          <div className="blueprint-prose text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
            {bp.executiveSummary.replace(/\*\*/g, '')}
          </div>
        </Card>
      )}

      {/* Risk register */}
      {bp.riskRegister?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Risk Register</CardTitle>
            <p className="text-sm text-text-muted mt-1">{bp.riskRegister.length} risks identified</p>
          </CardHeader>
          <div className="space-y-3">
            {bp.riskRegister.map((risk: any) => (
              <div key={risk.id} className="border border-border rounded-lg p-3 bg-elevated/50">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-text-primary">{risk.title}</p>
                  <SeverityBadge severity={risk.severity} />
                </div>
                <p className="text-xs text-text-secondary mb-2">{risk.description}</p>
                <p className="text-xs text-text-muted">
                  <span className="text-primary font-medium">Mitigation:</span> {risk.mitigation}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Action checklist */}
      {bp.actionItems?.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Action Items</CardTitle>
              <span className="text-sm text-text-muted">
                {doneCount}/{totalActions} completed
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-1.5 bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-phoenix-rise rounded-full transition-all duration-300"
                style={{ width: `${totalActions > 0 ? (doneCount / totalActions) * 100 : 0}%` }}
              />
            </div>
          </CardHeader>
          <div className="space-y-2">
            {bp.actionItems.map((action: any) => (
              <label
                key={action.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-elevated cursor-pointer group transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checkedItems.has(action.id)}
                  onChange={() => toggleCheck(action.id)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PriorityDot priority={action.priority} />
                    <span className={`text-sm font-medium ${checkedItems.has(action.id) ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                      {action.title}
                    </span>
                    <Badge variant="muted">{action.phase}</Badge>
                    <Badge variant="muted">{action.effort}</Badge>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{action.description}</p>
                </div>
              </label>
            ))}
          </div>
        </Card>
      )}

      {/* Dependency upgrades */}
      {bp.dependencyUpgrades?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Dependency Upgrades ({bp.dependencyUpgrades.length})</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 text-xs text-text-muted font-medium">Package</th>
                  <th className="pb-2 text-xs text-text-muted font-medium">Current</th>
                  <th className="pb-2 text-xs text-text-muted font-medium">Target</th>
                  <th className="pb-2 text-xs text-text-muted font-medium">Reason</th>
                  <th className="pb-2 text-xs text-text-muted font-medium">Priority</th>
                </tr>
              </thead>
              <tbody>
                {bp.dependencyUpgrades.map((dep: any) => (
                  <tr key={dep.name} className="border-b border-border/40 last:border-0">
                    <td className="py-2 font-mono text-text-primary text-xs">{dep.name}</td>
                    <td className="py-2 text-text-muted font-mono text-xs">{dep.currentVersion}</td>
                    <td className="py-2 text-success font-mono text-xs">{dep.targetVersion}</td>
                    <td className="py-2"><Badge variant={dep.reason === 'security' ? 'error' : 'muted'}>{dep.reason}</Badge></td>
                    <td className="py-2"><SeverityBadge severity={dep.priority} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Revival strategy */}
      {bp.revivalStrategy && (
        <Card>
          <CardHeader><CardTitle>Revival Strategy</CardTitle></CardHeader>
          <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap blueprint-prose">
            {bp.revivalStrategy.replace(/#{1,3} /g, '').replace(/\*\*/g, '')}
          </div>
        </Card>
      )}
    </div>
  );
}
