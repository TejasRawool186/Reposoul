import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span className="text-5xl mb-4">🔥</span>
      <h2 className="text-2xl font-bold text-text-primary mb-2">Page not found</h2>
      <p className="text-text-secondary mb-6">The page you are looking for does not exist.</p>
      <Link href="/" className="text-primary hover:underline text-sm">Back to Discover</Link>
    </div>
  );
}
