'use client';

import React from 'react';
import Link from 'next/link';

interface HeaderProps {
  variant?: string;
  participantId?: string;
  storageMode?: 'supabase' | 'local_sqlite';
}

export default function Header({ variant, participantId, storageMode = 'local_sqlite' }: HeaderProps) {
  const isSpatial = variant === 'spatial_impact';

  return (
    <header className="h-14 border-b border-[var(--border-hairline)] bg-[var(--surface)] px-4 flex items-center justify-between select-none z-30 shrink-0">
      {/* Left: Brand */}
      <div className="flex items-center space-x-3">
        <Link
          href="/"
          className="flex items-center space-x-2 text-[var(--text-hi)] hover:opacity-85 transition-opacity"
          aria-label="TerraLens home"
        >
          <span className="font-bold text-[16px] tracking-tight text-[var(--text-hi)]">
            TerraLens
          </span>
          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-[4px] bg-[var(--surface-raised)] border border-[var(--border-hairline)] text-[var(--text-mid)]">
            Console
          </span>
        </Link>
      </div>

      {/* Right: Navigation & Arm Indicator */}
      <div className="flex items-center space-x-3 text-xs">
        <div className="hidden sm:flex items-center space-x-1.5 text-[11px] font-mono text-[var(--text-mid)]">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: isSpatial ? 'var(--treatment)' : 'var(--control)' }}
          />
          <span className="capitalize">{isSpatial ? 'Spatial Impact' : 'Severity Only'}</span>
        </div>

        <Link
          href="/replay"
          className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-raised)] text-[var(--text-hi)] text-[12px] font-medium transition-colors"
        >
          Replay
        </Link>

        <Link
          href="/analytics"
          className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-raised)] text-[var(--text-hi)] text-[12px] font-medium transition-colors"
        >
          Analytics
        </Link>
      </div>
    </header>
  );
}
