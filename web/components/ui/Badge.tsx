import React from 'react';

type Variant = 'default' | 'success' | 'warning' | 'error' | 'primary' | 'muted';

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}

const variantClasses: Record<Variant, string> = {
  default:  'bg-elevated text-text-secondary border border-border',
  success:  'bg-success/15 text-success border border-success/30',
  warning:  'bg-warning/15 text-warning border border-warning/30',
  error:    'bg-error/15 text-error border border-error/30',
  primary:  'bg-primary/15 text-primary border border-primary/30',
  muted:    'bg-surface text-text-muted border border-border',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
