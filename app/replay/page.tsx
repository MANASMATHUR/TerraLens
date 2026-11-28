'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';

interface ReplayIncident {
  id: number;
  title: string;
  description: string;
  incident_type: string;
  severity_score: number;
  spatial_score: number;
  severity_rank: number;
  spatial_rank: number;
  rank_delta: number;
  population_exposed: number;
  population_capped?: boolean;
  hospital_count: number;
  fire_station_count: number;
  nearest_road_m: number;
  impact_radius_m: number;
  coordinates: [number, number];
  is_synthetic: boolean;
}

interface ReplaySummary {
  control_top_3: number[];
  treatment_top_3: number[];
  control_estimated_population_exposure: number;
  treatment_estimated_population_exposure: number;
  control_hospitals_covered: number;
  treatment_hospitals_covered: number;
  capped_incidents?: number;
  population_total_is_capped?: boolean;
}

export default function DecisionReplayPage() {
  const [data, setData] = useState<{ incidents: ReplayIncident[]; summary: ReplaySummary } | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<ReplayIncident | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'promoted' | 'demoted'>('all');
  const [sortBy, setSortBy] = useState<'spatial' | 'severity' | 'delta'>('spatial');

  useEffect(() => {
    fetch('/api/replay')
      .then((r) => r.json())
      .then((res) => {
        setData(res);
        if (res.incidents && res.incidents.length > 0) {
          const prime = res.incidents.find((i: ReplayIncident) => i.id === 7) || res.incidents[0];
          setSelectedIncident(prime);
        }
      })
      .catch(console.error);
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text-mid)] flex items-center justify-center font-sans text-sm">
        Loading Decision Replay comparison...
      </div>
    );
  }

  const { incidents, summary } = data;

  const filtered = incidents.filter((inc) => {
    if (filterType === 'promoted') return inc.rank_delta > 0;
    if (filterType === 'demoted') return inc.rank_delta < 0;
    return true;
  });

  const displayList = [...filtered].sort((a, b) => {
    if (sortBy === 'severity') return a.severity_rank - b.severity_rank;
    if (sortBy === 'delta') return b.rank_delta - a.rank_delta;
    return a.spatial_rank - b.spatial_rank;
  });

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-hi)] flex flex-col">
      <Header />

      <main className="max-w-7xl w-full mx-auto px-6 py-8 space-y-8 flex-1">
        {/* Page Header */}
        <div className="border-b border-slate-200 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <p className="text-xs font-mono uppercase tracking-wider text-slate-500">
              Decision Replay · Strategy Comparison
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
              Same incidents. Same severity. Different prioritization strategy.
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Compare how the 25 synthetic Jaipur incidents are ordered under Severity-only
              ranking (Variant A) versus Spatial-impact ranking (Variant B).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/task"
              className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-[var(--radius-sm)] hover:opacity-90 transition-opacity"
            >
              Open Operator Workspace
            </Link>
          </div>
        </div>

        {/* Top-3 Strategy Outcome Comparison */}
        <section aria-label="Top 3 Strategy Comparison" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-slate-200 bg-white rounded p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  Variant A: Severity-only Top 3
                </h2>
                <span className="text-xs font-mono text-amber-700">
                  IDs: {summary.control_top_3.map((id) => `#${id}`).join(', ')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Estimated Population Exposed</div>
                  <div className="text-lg font-mono font-semibold text-slate-900">
                    {summary.control_estimated_population_exposure.toLocaleString()} people
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Hospitals in Impact Zones</div>
                  <div className="text-lg font-mono font-semibold text-slate-900">
                    {summary.control_hospitals_covered} facilities
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 bg-white rounded p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  Variant B: Spatial-impact Top 3
                </h2>
                <span className="text-xs font-mono text-sky-700">
                  IDs: {summary.treatment_top_3.map((id) => `#${id}`).join(', ')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Estimated Population Exposed</div>
                  <div className="text-lg font-mono font-semibold text-sky-700">
                    {summary.treatment_estimated_population_exposure.toLocaleString()} people
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Hospitals in Impact Zones</div>
                  <div className="text-lg font-mono font-semibold text-sky-700">
                    {summary.treatment_hospitals_covered} facilities
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 italic">
            Population figures are capped at 38,000 per incident; the totals are sums of capped values.
          </p>
        </section>

        {/* Main Comparison Table + Selected Incident Explanation */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Table */}
          <div className="lg:col-span-8 border border-slate-200 bg-white rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Filter:</span>
                {(['all', 'promoted', 'demoted'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterType(f)}
                    className={`px-2.5 py-1 rounded-[var(--radius-sm)] border text-xs font-medium capitalize cursor-pointer ${
                      filterType === f
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-[var(--surface)] text-[var(--text-mid)] border-[var(--border-hairline)] hover:bg-[var(--surface-raised)]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Sort by:</span>
                <select
                  aria-label="Sort incidents"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'spatial' | 'severity' | 'delta')}
                  className="border border-slate-200 rounded px-2 py-1 bg-white text-slate-700 text-xs"
                >
                  <option value="spatial">Spatial-impact rank</option>
                  <option value="severity">Severity-only rank</option>
                  <option value="delta">Largest rank promotion</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-mono text-slate-500 bg-slate-50">
                    <th className="py-2.5 px-4 font-medium">Incident</th>
                    <th className="py-2.5 px-3 font-medium text-right">Severity</th>
                    <th className="py-2.5 px-3 font-medium text-right">Sev. Rank</th>
                    <th className="py-2.5 px-3 font-medium text-right">Spatial Rank</th>
                    <th className="py-2.5 px-3 font-medium text-right">Movement</th>
                    <th className="py-2.5 px-4 font-medium text-right">Est. Pop. Exposed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayList.map((inc) => {
                    const isSelected = selectedIncident?.id === inc.id;
                    return (
                      <tr
                        key={inc.id}
                        onClick={() => setSelectedIncident(inc)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-sky-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-slate-900">
                            #{inc.id} · {inc.title}
                          </div>
                          <div className="text-xs text-slate-500 capitalize">
                            {inc.incident_type.replace(/_/g, ' ')}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {inc.severity_score.toFixed(1)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          #{inc.severity_rank}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-sky-700">
                          #{inc.spatial_rank}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-medium ${
                            inc.rank_delta > 0
                              ? 'text-emerald-700'
                              : inc.rank_delta < 0
                              ? 'text-amber-700'
                              : 'text-slate-400'
                          }`}
                        >
                          {inc.rank_delta > 0
                            ? `+${inc.rank_delta}`
                            : inc.rank_delta < 0
                            ? `${inc.rank_delta}`
                            : '0'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                          {inc.population_capped ? '38,000 (capped)' : inc.population_exposed.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Explanation Panel */}
          <aside className="lg:col-span-4 border border-slate-200 bg-white rounded p-5 space-y-4">
            {selectedIncident ? (
              <>
                <div className="border-b border-slate-100 pb-3 space-y-1">
                  <span className="text-xs font-mono text-slate-500">
                    INCIDENT #{selectedIncident.id} · EXPLANATION
                  </span>
                  <h3 className="text-base font-semibold text-slate-900">
                    {selectedIncident.title}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm border-b border-slate-100 pb-4">
                  <div>
                    <div className="text-xs text-slate-500">Severity-only rank</div>
                    <div className="text-base font-mono font-semibold text-slate-900">
                      #{selectedIncident.severity_rank} (Score {selectedIncident.severity_score.toFixed(1)})
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Spatial-impact rank</div>
                    <div className="text-base font-mono font-semibold text-sky-700">
                      #{selectedIncident.spatial_rank} (Score {selectedIncident.spatial_score.toFixed(1)})
                    </div>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500">
                    Contextual factors influencing rank
                  </h4>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Estimated population exposed</span>
                    <span className="font-mono font-medium text-slate-900">
                      {selectedIncident.population_exposed.toLocaleString()} people
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Nearby hospitals</span>
                    <span className="font-mono font-medium text-slate-900">
                      {selectedIncident.hospital_count}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Nearby fire stations</span>
                    <span className="font-mono font-medium text-slate-900">
                      {selectedIncident.fire_station_count}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Distance to nearest road</span>
                    <span className="font-mono font-medium text-slate-900">
                      {selectedIncident.nearest_road_m} m
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Assumed impact radius</span>
                    <span className="font-mono font-medium text-slate-900">
                      {selectedIncident.impact_radius_m} m
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 border-t border-slate-100 pt-3 leading-relaxed">
                  {selectedIncident.rank_delta > 0
                    ? `Moved up ${selectedIncident.rank_delta} positions under Spatial-impact ranking due to its combined population exposure, facility proximity, and accessibility score.`
                    : selectedIncident.rank_delta < 0
                    ? `Moved down ${Math.abs(selectedIncident.rank_delta)} positions under Spatial-impact ranking because other incidents had higher combined spatial-context scores.`
                    : 'Maintained the same rank under both strategies.'}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">Select an incident from the table to inspect its ranking factors.</p>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
