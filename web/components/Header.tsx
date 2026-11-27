'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useToken } from '@/lib/token-context';

export function Header() {
  const { token, setToken, hasToken } = useToken();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function handleSave() {
    setToken(draft.trim());
    setEditing(false);
    setDraft('');
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto px-4 max-w-6xl h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span className="text-2xl leading-none select-none">🔥</span>
          <span className="font-bold text-base tracking-tight text-text-primary">
            REPOSOUL
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden sm:flex items-center gap-1 text-sm">
          <Link href="/" className="px-3 py-1.5 rounded hover:bg-elevated text-text-secondary hover:text-text-primary transition-colors">
            Discover
          </Link>
        </nav>

        {/* Token indicator */}
        <div className="flex items-center gap-2 shrink-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="password"
                autoFocus
                placeholder="github token..."
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
                className="bg-elevated border border-primary rounded px-2 py-1 text-xs text-text-primary w-44 focus:outline-none"
              />
              <button onClick={handleSave} className="text-xs text-primary hover:text-secondary transition-colors">Save</button>
              <button onClick={() => setEditing(false)} className="text-xs text-text-muted hover:text-text-primary">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => { setEditing(true); setDraft(''); }}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border transition-colors"
              style={hasToken
                ? { borderColor: 'rgba(34,197,94,0.4)', color: '#22C55E', backgroundColor: 'rgba(34,197,94,0.08)' }
                : { borderColor: '#333', color: '#A1A1AA' }}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${hasToken ? 'bg-success' : 'bg-text-muted'}`} />
              {hasToken ? 'Token set' : 'Set token'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
