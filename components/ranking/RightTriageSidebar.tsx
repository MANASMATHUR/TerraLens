'use client';

import React, { useState } from 'react';
import { IncidentWithContext, ExperimentVariant } from '@/types';
import IncidentRadarChart from '@/components/charts/IncidentRadarChart';

interface RightTriageSidebarProps {
  incidents: IncidentWithContext[];
  selectedIds: number[];
  variant: ExperimentVariant;
  onSubmit: () => void;
  isSubmitting: boolean;
  timeExpired: boolean;
  timeFormatted: string;
  onInspectWhy?: (incident: IncidentWithContext) => void;
  focusedIncident?: IncidentWithContext | null;
}

export default function RightTriageSidebar({
  incidents,
  selectedIds,
  variant,
  onSubmit,
  isSubmitting,
  timeExpired,
  timeFormatted,
  onInspectWhy,
  focusedIncident,
}: RightTriageSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isComplete = selectedIds.length === 3;

  // Active inspected incident: prioritize explicitly focused, then last selected, then top incident
  const activeIncident =
    focusedIncident ||
    (selectedIds.length > 0
      ? incidents.find((i) => i.id === selectedIds[selectedIds.length - 1]) || incidents[0]
      : incidents[0]);

  if (isCollapsed) {
    return (
      <aside className="absolute inset-y-0 right-0 w-12 md:relative h-full bg-white border-l border-slate-200 flex flex-col items-center justify-between py-4 select-none z-30">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-1.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-mono font-semibold cursor-pointer transition-colors"
          title="Expand Investigation Panel"
          aria-label="Expand Investigation Panel"
        >
          ◀
        </button>

        <div className="space-y-4 flex flex-col items-center text-center">
          <div className="rotate-90 origin-center text-[10px] font-mono font-semibold text-slate-700 whitespace-nowrap">
            {timeFormatted}
          </div>
          <div className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-mono font-semibold flex items-center justify-center">
            {selectedIds.length}/3
          </div>
        </div>

        <button
          onClick={onSubmit}
          disabled={!isComplete || isSubmitting || timeExpired}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
            isComplete && !timeExpired && !isSubmitting
              ? 'bg-emerald-500 text-white cursor-pointer hover:scale-105'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
          title="Confirm Dispatch"
        >
          ✓
        </button>
      </aside>
    );
  }

  return (
    <aside className="absolute inset-y-0 right-0 w-[min(88vw,320px)] md:relative md:w-80 h-full bg-white border-l border-slate-200 flex flex-col justify-between select-none z-30 text-slate-900 text-xs shrink-0 shadow-xl transition-all">
      <div className="p-3.5 space-y-3.5 overflow-y-auto flex-1">
        {/* Top Header with Collapse Button */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
            INVESTIGATION PANEL
          </span>
          <button
            onClick={() => setIsCollapsed(true)}
            className="text-[10px] font-mono px-2 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold transition-colors cursor-pointer"
            title="Collapse Sidebar"
          >
            ▶ Collapse
          </button>
        </div>

        {/* Session Timer & Status */}
        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold">
              TIME REMAINING
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {timeFormatted}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-600 font-semibold shadow-2xs">
              120s Limit
            </span>
          </div>
        </div>

        {/* Dispatch Action Button */}
        <button
          onClick={onSubmit}
          disabled={!isComplete || isSubmitting || timeExpired}
          className={`w-full py-3 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-sm flex items-center justify-center space-x-2 ${
            isComplete && !timeExpired && !isSubmitting
              ? 'bg-sky-600 hover:bg-sky-700 text-white cursor-pointer hover:shadow-md'
              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
          }`}
        >
          {timeExpired ? (
            <span>Window Expired</span>
          ) : isSubmitting ? (
            <span>Evaluating with Server...</span>
          ) : isComplete ? (
            <span>Confirm & Dispatch (3/3) ✓</span>
          ) : (
            <span>Select 3 Incidents ({selectedIds.length}/3)</span>
          )}
        </button>

        {/* Selected Incidents Dispatch Dock */}
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase font-mono font-bold tracking-wider text-slate-500 flex items-center justify-between">
            <span>DISPATCH QUEUE</span>
            <span className="text-sky-700 font-bold">{selectedIds.length} / 3</span>
          </div>

          {selectedIds.length === 0 ? (
            <div className="p-3 rounded-md border border-dashed border-slate-300 text-center text-xs text-slate-500 bg-slate-50">
              Click incidents on map or list to select top 3.
            </div>
          ) : (
            selectedIds.map((id) => {
              const inc = incidents.find((i) => i.id === id);
              if (!inc) return null;
              return (
                <div
                  key={id}
                  className="p-2 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-between text-xs shadow-2xs"
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      ✓
                    </span>
                    <span className="font-semibold text-slate-800 text-xs truncate">
                      #{inc.id} {inc.title.split(' - ')[0]}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-sky-700 bg-sky-100/60 px-1.5 py-0.5 rounded border border-sky-200 text-xs pl-2">
                    {inc.display_score.toFixed(1)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Active Incident Inspector & ECharts Profiling */}
        {activeIncident && (
          <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="font-bold text-slate-900 text-xs truncate">
                #{activeIncident.id} {activeIncident.title.split(' - ')[0]}
              </span>
              <span className="font-mono text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                {activeIncident.display_score.toFixed(1)} pts
              </span>
            </div>

            <p className="text-[11px] text-slate-600 leading-normal line-clamp-2">
              {activeIncident.description}
            </p>

            {/* ECharts Spatial Risk Vector Radar Profile */}
            <div className="p-2 rounded-md bg-slate-900 border border-slate-800 space-y-1">
              <div className="text-[9px] font-mono uppercase font-bold text-slate-400 flex justify-between">
                <span>ECharts Multi-Vector Risk Profile</span>
                <span className="text-sky-400">#JPR-{activeIncident.id.toString().padStart(3, '0')}</span>
              </div>
              <IncidentRadarChart incident={activeIncident} height={145} />
            </div>

            {/* Raw Context Metrics */}
            <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px] text-slate-600 font-mono">
              <div>Severity: <strong className="text-slate-900">{activeIncident.severity_score}/100</strong></div>
              <div>Experiment pop. est.: <strong className="text-slate-900">{(activeIncident.context.population_exposed / 1000).toFixed(1)}k</strong></div>
              <div>Hospitals: <strong className="text-slate-900">{activeIncident.context.hospital_count} in zone</strong></div>
              <div>Road Reach: <strong className="text-slate-900">{activeIncident.context.nearest_road_distance_m.toFixed(0)}m</strong></div>
            </div>
            <p className="text-[9px] text-slate-500">Population exposure is the historical synthetic experiment estimate; it is separate from the map surface.</p>

            {/* Why This Incident Explainability Trigger */}
            {onInspectWhy && (
              <div className="pt-1.5">
                <button
                  type="button"
                  onClick={() => onInspectWhy(activeIncident)}
                  className="w-full py-1.5 px-2.5 rounded border border-sky-300 bg-sky-50/80 hover:bg-sky-100 text-sky-800 text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <span>Why This Incident?</span>
                  <span className="font-mono text-[10px] text-sky-600">
                    ({variant === 'spatial_impact' ? 'S_B Breakdown' : 'S_A Breakdown'})
                  </span>
                  <span>🔍</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
