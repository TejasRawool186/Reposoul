'use client';

import React from 'react';

interface ScoreRingProps {
  value: number;      // 0–100
  label: string;
  size?: number;      // px, default 80
  strokeWidth?: number;
}

function scoreColor(v: number): string {
  if (v >= 70) return '#22C55E';
  if (v >= 40) return '#EAB308';
  return '#EF4444';
}

export function ScoreRing({ value, label, size = 80, strokeWidth = 7 }: ScoreRingProps) {
  const r = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * (value / 100);
  const color = scoreColor(value);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background track */}
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke="#1f1f1f"
            strokeWidth={strokeWidth}
          />
          {/* Filled arc */}
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - filled}
            style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
          />
        </svg>
        {/* Score number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color }}>{value}</span>
        </div>
      </div>
      <span className="text-xs text-text-muted text-center leading-tight max-w-[70px]">{label}</span>
    </div>
  );
}
