'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RepoCard } from '@/components/RepoCard';
import { Spinner } from '@/components/ui/Spinner';
import { useToken } from '@/lib/token-context';
import { searchRepositories } from '@/lib/api';

const LANGUAGES = ['', 'TypeScript', 'JavaScript', 'Python', 'Rust', 'Go', 'Java', 'C++'];
const STAR_OPTIONS = [
  { label: 'Any', value: '' },
  { label: '10+', value: '10' },
  { label: '50+', value: '50' },
  { label: '100+', value: '100' },
  { label: '500+', value: '500' },
  { label: '1000+', value: '1000' },
];

export default function HomePage() {
  const router = useRouter();
  const { token, hasToken } = useToken();

  // Search form state
  const [language, setLanguage] = useState('TypeScript');
  const [minStars, setMinStars] = useState('100');
  const [pushedBefore, setPushedBefore] = useState('2022-01-01');
  const [analyzeInput, setAnalyzeInput] = useState('');

  // Results state
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResults([]);
    setSearched(true);

    try {
      const data: any = await searchRepositories(
        { language: language || undefined, minStars: minStars ? Number(minStars) : undefined, pushedBefore: pushedBefore || undefined, limit: 12 },
        token
      );
      setResults(data?.items ?? []);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    const repo = analyzeInput.trim();
    if (!repo.includes('/')) { setError('Enter repository in owner/repo format'); return; }
    const [owner, name] = repo.split('/');
    router.push(`/investigate/${owner}/${name}`);
  }

  return (
    <div className="flex flex-col gap-10 animate-fade-in">
      {/* Hero */}
      <section className="text-center pt-6 pb-2">
        <div className="text-5xl mb-4 select-none">🔥</div>
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight mb-3">
          Give abandoned software<br />
          <span className="bg-phoenix-rise bg-clip-text text-transparent">a second life.</span>
        </h1>
        <p className="text-text-secondary max-w-xl mx-auto leading-relaxed">
          Discover abandoned open-source repositories, assess their revival potential, and generate structured revival blueprints.
        </p>
        {!hasToken && (
          <p className="text-xs text-warning mt-3">
            Set a GitHub token in the header to avoid rate limits (60 req/hr without token).
          </p>
        )}
      </section>

      {/* Quick analyze */}
      <section className="bg-surface border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">Analyze a specific repository</h2>
        <form onSubmit={handleAnalyze} className="flex gap-2">
          <input
            type="text"
            value={analyzeInput}
            onChange={e => setAnalyzeInput(e.target.value)}
            placeholder="owner/repository-name"
            className="flex-1 bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-colors font-mono"
          />
          <Button type="submit" disabled={!analyzeInput.trim()}>Analyze</Button>
        </form>
      </section>

      {/* Discovery search */}
      <section>
        <h2 className="text-lg font-semibold text-text-primary mb-4">Discover abandoned repositories</h2>
        <form onSubmit={handleSearch} className="bg-surface border border-border rounded-lg p-5 flex flex-wrap gap-4 items-end">
          {/* Language */}
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <label className="text-xs text-text-secondary font-medium uppercase tracking-wider">Language</label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l || 'Any'}</option>)}
            </select>
          </div>

          {/* Min stars */}
          <div className="flex flex-col gap-1.5 min-w-[110px]">
            <label className="text-xs text-text-secondary font-medium uppercase tracking-wider">Min stars</label>
            <select
              value={minStars}
              onChange={e => setMinStars(e.target.value)}
              className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
            >
              {STAR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Pushed before */}
          <div className="flex flex-col gap-1.5 min-w-[150px]">
            <label className="text-xs text-text-secondary font-medium uppercase tracking-wider">Last active before</label>
            <input
              type="date"
              value={pushedBefore}
              onChange={e => setPushedBefore(e.target.value)}
              className="bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary [color-scheme:dark]"
            />
          </div>

          <Button type="submit" loading={loading} className="shrink-0">
            Search
          </Button>
        </form>

        {/* Error */}
        {error && (
          <div className="mt-4 bg-error/10 border border-error/30 rounded-lg p-3 text-sm text-error">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Spinner size="lg" />
              <p className="text-text-muted text-sm">Searching GitHub...</p>
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <div className="mt-6 animate-slide-up">
            <p className="text-sm text-text-muted mb-4">{results.length} repositories found</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((repo: any) => (
                <RepoCard key={repo.id} repo={repo} />
              ))}
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && searched && results.length === 0 && !error && (
          <div className="text-center py-12 text-text-muted">
            <p className="text-lg mb-1">No results</p>
            <p className="text-sm">Try adjusting your filters.</p>
          </div>
        )}
      </section>
    </div>
  );
}
