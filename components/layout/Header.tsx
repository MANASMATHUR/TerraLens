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
  const isSupabase = storageMode === 'supabase';

  return (
    <header className="h-13 border-b border-slate-200 bg-white px-4 flex items-center justify-between select-none z-30 flex-shrink-0 shadow-2xs">
      {/* Left: Brand */}
      <div className="flex items-center space-x-3">
        <Link href="/" className="flex items-center text-slate-900 hover:opacity-80 transition-opacity" aria-label="TerraLens home">
          <img src="/terralens-logo.svg" alt="TerraLens" className="h-10 w-auto max-w-[150px] object-contain" />
        </Link>
      </div>

      {/* Right: Navigation */}
      <div className="flex items-center space-x-3 text-xs">

        {/* Decision Replay Link */}
        <Link
          href="/replay"
          className="px-3 py-1.5 rounded border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 text-xs font-bold shadow-2xs transition-colors flex items-center space-x-1.5"
        >
          <svg className="w-3 h-3 fill-current" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 2L10 6L2.5 10V2Z" />
          </svg>
          <span>Decision Replay</span>
        </Link>

        {/* Analytics Link */}
        <Link
          href="/analytics"
          className="px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-2xs transition-colors"
        >
          Experiment Analytics
        </Link>
      </div>
    </header>
  );
}
