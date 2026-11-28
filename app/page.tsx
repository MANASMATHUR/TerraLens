'use client';

import React from 'react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-hi)] font-sans flex flex-col selection:bg-[var(--accent)] selection:text-white">
      {/* 1. Nav: wordmark "TerraLens", links Task, Replay, Analytics, GitHub, and filled primary button */}
      <nav className="sticky top-0 z-40 h-16 bg-[var(--surface)] border-b border-[var(--border-hairline)] px-6 flex items-center justify-between select-none">
        <div className="max-w-[1080px] w-full mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 text-[var(--text-hi)] font-bold text-[18px] tracking-tight">
            <span>TerraLens</span>
          </Link>

          <div className="flex items-center space-x-5 text-[13px] font-medium text-[var(--text-mid)]">
            <Link href="/task" className="hover:text-[var(--text-hi)] transition-colors">
              Task
            </Link>
            <Link href="/replay" className="hover:text-[var(--text-hi)] transition-colors">
              Replay
            </Link>
            <Link href="/analytics" className="hover:text-[var(--text-hi)] transition-colors">
              Analytics
            </Link>
            <a
              href="https://github.com/MANASMATHUR/TerraLens"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[var(--text-hi)] transition-colors"
            >
              GitHub
            </a>
            <Link
              href="/task"
              className="py-2 px-4 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:opacity-90 text-white font-semibold text-[13px] transition-all shadow-xs"
            >
              Open the task
            </Link>
          </div>
        </div>
      </nav>

      {/* 2. Hero: Two columns (Desktop). Max width 1080px, 96px vertical rhythm */}
      <main className="max-w-[1080px] w-full mx-auto px-6 py-20 flex-1 space-y-24">
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Hero Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="text-[11px] font-mono uppercase tracking-widest text-[var(--accent)] font-bold">
              Toggle Wars · Track 01
            </div>
            <h1 className="text-[44px] font-bold leading-[1.15] text-[var(--text-hi)] tracking-tight">
              Rank incidents by what is at stake, not just how severe they sound
            </h1>
            <p className="text-[17px] text-[var(--text-mid)] leading-relaxed">
              When an infrastructure disaster strikes, raw technical alerts deceive operators into prioritizing loud telemetry over civilian consequence. TerraLens tests whether spatial intelligence flags improve real-world human triage accuracy under tight operational deadlines.
            </p>
            <div className="pt-2 flex items-center space-x-4">
              <Link
                href="/task"
                className="py-3 px-6 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:opacity-90 text-white font-bold text-[14px] transition-all shadow-xs"
              >
                Open the task
              </Link>
              <Link
                href="/analytics"
                className="py-3 px-6 rounded-[var(--radius-sm)] border border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-raised)] text-[var(--text-hi)] font-semibold text-[14px] transition-all"
              >
                See the experiment
              </Link>
            </div>
          </div>

          {/* Right Hero Column: Static mini map 520x400 showing real 25 incidents without exposing Flag */}
          <div className="lg:col-span-5 relative w-full h-[400px] bg-[var(--surface)] rounded-[var(--radius-md)] border border-[var(--border-hairline)] shadow-[var(--shadow-floating)] p-4 flex flex-col justify-between overflow-hidden">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-mid)] font-semibold flex justify-between items-center pb-2 border-b border-[var(--border-hairline)]">
              <span>Jaipur GIS Spatial Grid</span>
              <span className="text-[var(--accent)]">25 Operational Units</span>
            </div>

            {/* Static Schematic Representation of 25 Incidents */}
            <div className="relative flex-1 my-3 bg-[var(--surface-raised)] rounded-[var(--radius-sm)] border border-[var(--border-hairline)] overflow-hidden flex items-center justify-center">
              <svg className="w-full h-full" viewBox="0 0 400 240">
                {/* City boundary outline */}
                <rect x="20" y="20" width="360" height="200" rx="8" fill="none" stroke="var(--border-hairline)" strokeDasharray="4 4" />
                
                {/* Cluster 1: High population cluster */}
                <circle cx="150" cy="110" r="45" fill="var(--treatment)" fillOpacity="0.08" />
                <circle cx="150" cy="110" r="14" fill="var(--treatment)" fillOpacity="0.18" />
                <circle cx="150" cy="110" r="5" fill="var(--treatment)" stroke="#FFFFFF" strokeWidth="1.5" />
                <text x="150" y="98" fontSize="10" fontWeight="bold" fill="var(--text-hi)" textAnchor="middle">#1</text>

                <circle cx="170" cy="125" r="35" fill="var(--treatment)" fillOpacity="0.08" />
                <circle cx="170" cy="125" r="5" fill="var(--treatment)" stroke="#FFFFFF" strokeWidth="1.5" />
                <text x="170" y="142" fontSize="9" fill="var(--text-mid)" textAnchor="middle">#2</text>

                {/* Cluster 2: Secondary cluster */}
                <circle cx="270" cy="70" r="40" fill="var(--treatment)" fillOpacity="0.08" />
                <circle cx="270" cy="70" r="5" fill="var(--treatment)" stroke="#FFFFFF" strokeWidth="1.5" />
                <text x="270" y="58" fontSize="10" fontWeight="bold" fill="var(--text-hi)" textAnchor="middle">#3</text>

                {/* Outlying dots */}
                {[
                  [80, 50], [90, 160], [120, 80], [210, 90], [240, 150], [300, 120], [320, 180],
                  [70, 120], [220, 170], [290, 80], [140, 170], [180, 60], [250, 40], [330, 90]
                ].map(([cx, cy], idx) => (
                  <circle key={idx} cx={cx} cy={cy} r="3" fill="var(--control)" opacity="0.6" />
                ))}
              </svg>

              {/* Floating Card over map showing top three under current strategy */}
              <div className="absolute bottom-3 left-3 right-3 p-3 rounded-[var(--radius-sm)] bg-[var(--surface)]/95 backdrop-blur-xs border border-[var(--border-hairline)] shadow-xs">
                <div className="text-[10px] font-mono uppercase text-[var(--text-mid)] font-semibold mb-1">
                  Top 3 Spatial Impact Priority Targets
                </div>
                <div className="text-[11px] text-[var(--text-hi)] font-medium truncate">
                  1. JLN Marg 220kV Substation (38k pop · 3 Hosp)
                </div>
                <div className="text-[11px] text-[var(--text-hi)] font-medium truncate">
                  2. Ashok Nagar Gas Main (38k pop · 1 Hosp)
                </div>
              </div>
            </div>

            <div className="text-[10px] text-[var(--text-low)] font-mono text-center">
              Static geospatial telemetry preview · No active identity exposure recorded
            </div>
          </div>
        </section>

        {/* 3. Proof Strip: One-line on surface-raised */}
        <section className="p-4 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-hairline)] flex flex-col md:flex-row items-center justify-between text-[13px] text-[var(--text-hi)] font-mono gap-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 tabular-nums">
            <Link href="/analytics" className="hover:underline">
              Flagsmith assigned <strong>50/50</strong>
            </Link>
            <span>•</span>
            <Link href="/analytics" className="hover:underline">
              <strong>123</strong> identities measured
            </Link>
            <span>•</span>
            <Link href="/analytics" className="hover:underline text-[var(--ok)]">
              <strong>+45.8%</strong> mean consequence capture
            </Link>
            <span>•</span>
            <Link href="/analytics" className="hover:underline">
              <strong>99.99%</strong> chance to be best
            </Link>
          </div>
          <div className="text-[11px] text-[var(--text-mid)] italic">
            scripted QA operators, simulated, <Link href="/analytics" className="underline">experiment 581</Link>
          </div>
        </section>

        {/* 4. How It Works: Four numbered steps in a row */}
        <section className="space-y-8">
          <div className="text-[11px] font-mono uppercase tracking-widest text-[var(--accent)] font-bold">
            Workflow Architecture
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-5 rounded-[var(--radius-sm)] border border-[var(--border-hairline)] bg-[var(--surface)] space-y-2">
              <div className="text-[24px] font-bold font-mono text-[var(--text-hi)] tabular-nums">01</div>
              <h3 className="font-semibold text-[14px] text-[var(--text-hi)]">Flag Decides Ranking</h3>
              <p className="text-[12px] text-[var(--text-mid)] leading-relaxed">
                Flagsmith assigns each operator to either pure technical SCADA severity or multivariate spatial-consequence scoring.
              </p>
            </div>

            <div className="p-5 rounded-[var(--radius-sm)] border border-[var(--border-hairline)] bg-[var(--surface)] space-y-2">
              <div className="text-[24px] font-bold font-mono text-[var(--text-hi)] tabular-nums">02</div>
              <h3 className="font-semibold text-[14px] text-[var(--text-hi)]">Operator Triage</h3>
              <p className="text-[12px] text-[var(--text-mid)] leading-relaxed">
                Under a strict 2-minute deadline, the dispatcher selects exactly three high-priority infrastructure targets.
              </p>
            </div>

            <div className="p-5 rounded-[var(--radius-sm)] border border-[var(--border-hairline)] bg-[var(--surface)] space-y-2">
              <div className="text-[24px] font-bold font-mono text-[var(--text-hi)] tabular-nums">03</div>
              <h3 className="font-semibold text-[14px] text-[var(--text-hi)]">Server Scoring</h3>
              <p className="text-[12px] text-[var(--text-mid)] leading-relaxed">
                The secure backend scores picks against an isolated ground-truth physical disruption benchmark.
              </p>
            </div>

            <div className="p-5 rounded-[var(--radius-sm)] border border-[var(--border-hairline)] bg-[var(--surface)] space-y-2">
              <div className="text-[24px] font-bold font-mono text-[var(--text-hi)] tabular-nums">04</div>
              <h3 className="font-semibold text-[14px] text-[var(--text-hi)]">Flagsmith Verifies</h3>
              <p className="text-[12px] text-[var(--text-mid)] leading-relaxed">
                Flagsmith captures conversion telemetry and computes statistical Bayesian lift and win probability.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] border border-[var(--border-hairline)] text-center text-[12px] text-[var(--text-mid)] font-mono">
            "Deleting Flagsmith removes the treatment, the assignment, the weights and the measurement."
          </div>
        </section>
      </main>

      {/* 5. Footer */}
      <footer className="border-t border-[var(--border-hairline)] bg-[var(--surface)] px-6 py-8 text-[12px] text-[var(--text-mid)]">
        <div className="max-w-[1080px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            Built for <strong>WeMakeDevs × Flagsmith Toggle Wars 2026</strong> · Apache 2.0 License
          </div>
          <div className="font-mono text-[11px] text-[var(--text-low)]">
            Data is synthetic · Population: radial model · Incidents: simulated monsoon scenario
          </div>
        </div>
      </footer>
    </div>
  );
}
