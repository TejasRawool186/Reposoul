'use client';

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm text-text-secondary font-medium">{label}</label>
      )}
      <input
        className={`bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-colors ${error ? 'border-error' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
