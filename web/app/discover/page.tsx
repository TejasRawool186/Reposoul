'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { RepoCard } from '@/components/RepoCard';
import { useToken } from '@/lib/token-context';
import { aiSearch } from '@/lib/api';

const SUGGESTIONS = [
  'Abandoned Python machine learning libraries with 500+ stars',
  'Unmaintained TypeScript UI component libraries',
  'Dead Rust networking projects with active forks',
  'Inactive Go web frameworks that could be revived',
  'Old JavaScript animation libraries with no recent commits',
  'Abandoned Java database connectors with security vulnerabilities',
];

const RECENT_KEY = 'reposoul:recent-searches';

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  try {
    const existing = getRecentSearches();
    const updated = [query, ...existing.filter(q => q !== query)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

export default function DiscoverPage() {
  const { token } = useToken();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [meta, setMeta] = useState<{
    totalCandidates?: number;
    executionTimeMs?: number;
    aiProvider?: string;
    intent?: any;
  } | null>(null);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  async function runSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');
    setResults([]);
    setMeta(null);
    setSearched(true);
    setQuery(trimmed);

    saveRecentSearch(trimmed);
    setRecentSearches(getRecentSearches());

    try {
      const data: any = await aiSearch({ query: trimmed, maxResults: 12 }, token);
      setResults(data?.results ?? []);
      setMeta({
        totalCandidates: data?.totalCandidates,
        executionTimeMs: data?.executionTimeMs,
        aiProvider: data?.aiProvider,
        intent: data?.intent,
      });
    } catch (err: any) {
      setError(err.message || 'AI search failed');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(query);
  }

  function handleSuggestion(s: string) {
    setQuery(s);
    runSearch(s);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      runSearch(query);
    }
  }

  return (
    <div className="flex flex-col gap-10 animate-fade-in">
      {/* Hero */}
      <section className="text-center pt-6 pb-2">
        <div className="text-5xl mb-4 select-none">🤖</div>
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight mb-3">
          AI-Powered Discovery
        </h1>
        <p className="text-text-secondary max-w-xl mx-auto leading-relaxed">
          Describe what you are looking for in plain language. REPOSOUL interprets your query,
          searches GitHub semantically, and ranks results by revival potential.
        </p>
      </section>

      {/* Search form */}
      <section className="bg-surface border border-border rounded-lg p-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Natural language query
          </label>
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Abandoned Python ML libraries with over 500 stars that haven't been updated in 2 years"
              rows={3}
              className="w-full bg-elevated border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-colors resize-none leading-relaxed"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-text-muted">
              Press <kbd className="bg-elevated border border-border rounded px-1 py-0.5 text-xs font-mono">Enter</kbd> to search, <kbd className="bg-elevated border border-border rounded px-1 py-0.5 text-xs font-mono">Shift+Enter</kbd> for new line
            </p>
            <Button type="submit" loading={loading} disabled={!query.trim()}>
              AI Search
            </Button>
          </div>
        </form>
      </section>

      {/* Suggestions */}
      {!searched && (
        <section>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Try these searches
          </h2>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => handleSuggestion(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-border bg-surface hover:border-primary/50 hover:text-primary text-text-secondary transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {recentSearches.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
                Recent searches
              </h2>
              <div className="flex flex-col gap-1.5">
                {recentSearches.map(s => (
                  <button
                    key={s}
                    onClick={() => handleSuggestion(s)}
                    className="text-left text-sm text-text-secondary hover:text-primary transition-colors flex items-center gap-2 group"
                  >
                    <span className="text-text-muted group-hover:text-primary transition-colors">↩</span>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <p className="text-text-muted text-sm">Analyzing your query and searching GitHub...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-error/10 border border-error/30 rounded-lg p-4 text-sm text-error">
          {error}
        </div>
      )}

      {/* Meta bar */}
      {!loading && meta && results.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted border-b border-border pb-3">
          <span>{results.length} results from {meta.totalCandidates} candidates</span>
          {meta.executionTimeMs && <span>{(meta.executionTimeMs / 1000).toFixed(1)}s</span>}
          {meta.aiProvider && (
            <span className={`flex items-center gap-1 ${meta.aiProvider === 'groq' ? 'text-success' : 'text-warning'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.aiProvider === 'groq' ? 'bg-success' : 'bg-warning'}`} />
              {meta.aiProvider === 'groq' ? 'Groq AI active' : 'Fallback mode (no AI key)'}
            </span>
          )}
          {meta.intent?.confidence && (
            <span>Query confidence: {Math.round(meta.intent.confidence * 100)}%</span>
          )}
        </div>
      )}

      {/* Intent summary */}
      {!loading && meta?.intent && results.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-4 text-sm">
          <p className="text-text-secondary font-medium mb-2">Query interpreted as:</p>
          <div className="flex flex-wrap gap-2 text-xs">
            {meta.intent.languages?.length > 0 && (
              <span className="bg-elevated border border-border rounded-full px-2.5 py-1 text-text-primary">
                Lang: {meta.intent.languages.join(', ')}
              </span>
            )}
            {meta.intent.keywords?.length > 0 && (
              <span className="bg-elevated border border-border rounded-full px-2.5 py-1 text-text-primary">
                Keywords: {meta.intent.keywords.join(', ')}
              </span>
            )}
            {meta.intent.abandonmentPreference && meta.intent.abandonmentPreference !== 'any' && (
              <span className="bg-elevated border border-border rounded-full px-2.5 py-1 text-warning">
                {meta.intent.abandonmentPreference === 'definitely_abandoned' ? 'Definitely abandoned' : 'Likely abandoned'}
              </span>
            )}
            {meta.intent.minimumStars && (
              <span className="bg-elevated border border-border rounded-full px-2.5 py-1 text-text-primary">
                ⭐ {meta.intent.minimumStars}+
              </span>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <section className="animate-slide-up">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((item: any) => {
              const repo = item.repository ?? item;
              return (
                <div key={repo.id} className="flex flex-col gap-2">
                  <RepoCard repo={repo} />
                  {/* Match reason */}
                  {item.matchReason && (
                    <p className="text-xs text-text-muted px-1 leading-relaxed">
                      {item.matchReason}
                    </p>
                  )}
                  {/* Technical problems */}
                  {item.technicalProblems?.length > 0 && (
                    <div className="flex flex-wrap gap-1 px-1">
                      {item.technicalProblems.slice(0, 3).map((p: string) => (
                        <span key={p} className="text-xs bg-error/10 border border-error/30 text-error rounded-full px-2 py-0.5">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Scores */}
                  {item.hybridScore !== undefined && (
                    <div className="flex gap-3 px-1 text-xs text-text-muted">
                      <span>Score: <span className="text-primary font-medium">{item.hybridScore}</span></span>
                      {item.semanticScore !== undefined && (
                        <span>Semantic: <span className="text-text-secondary">{Math.round(item.semanticScore * 100)}%</span></span>
                      )}
                      <span>Rank #{item.rank}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty */}
      {!loading && searched && results.length === 0 && !error && (
        <div className="text-center py-12 text-text-muted">
          <p className="text-lg mb-1">No results found</p>
          <p className="text-sm">Try rephrasing your query or be less specific about language or star count.</p>
        </div>
      )}
    </div>
  );
}
