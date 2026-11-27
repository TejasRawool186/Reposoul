'use client';

import React from 'react';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span className="text-5xl mb-4">⚠️</span>
      <h2 className="text-xl font-bold text-text-primary mb-2">Something went wrong</h2>
      <p className="text-sm text-text-secondary mb-6 max-w-md">{error.message}</p>
      <button onClick={reset} className="text-primary hover:underline text-sm">Try again</button>
    </div>
  );
}
