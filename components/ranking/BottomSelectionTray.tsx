'use client';

import React from 'react';
import { IncidentWithContext, ExperimentVariant } from '@/types';

interface BottomSelectionTrayProps {
  incidents: IncidentWithContext[];
  selectedIds: number[];
  variant: ExperimentVariant;
  onRemove: (id: number) => void;
  onSubmit: () => void;
}

export default function BottomSelectionTray({
  incidents,
  selectedIds,
  variant,
  onRemove,
  onSubmit,
}: BottomSelectionTrayProps) {
  const selectedIncidents = selectedIds
    .map((id) => incidents.find((i) => i.id === id))
    .filter(Boolean) as IncidentWithContext[];

  const isReady = selectedIds.length === 3;

  return (
    <div className="absolute bottom-4 left-4 right-88 z-30 pointer-events-auto">
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl p-3 shadow-2xl text-white select-none">
        {/* Tray Header Bar */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/80 text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-bold tracking-wider uppercase text-[11px] text-slate-100">
              ACTIVE STRATEGY: {variant === 'spatial_impact' ? 'TREATMENT (SPATIAL IMPACT S_B)' : 'CONTROL (SEVERITY ONLY S_A)'}
            </span>
          </div>
          <div className="flex items-center space-x-3 text-xs">
            <span className="font-mono text-slate-300">
              {selectedIds.length} OF 3 ASSIGNED
            </span>
            {isReady && (
              <button
                onClick={onSubmit}
                className="px-3 py-1 rounded bg-[#00d084] hover:bg-[#00d084]/90 text-slate-950 font-bold text-xs cursor-pointer shadow-sm transition-all"
              >
                Dispatch All 3 →
              </button>
            )}
          </div>
        </div>

        {/* 3 Clickable Dispatch Slots */}
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((slotIdx) => {
            const inc = selectedIncidents[slotIdx];
            if (!inc) {
              return (
                <div
                  key={slotIdx}
                  className="p-3 rounded-lg border-2 border-dashed border-slate-700 bg-slate-800/40 text-center flex flex-col items-center justify-center space-y-1 text-slate-400"
                >
                  <span className="text-xs font-bold text-slate-400 font-mono">
                    SLOT {slotIdx + 1}: EMPTY
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Click any incident card or map beacon
                  </span>
                </div>
              );
            }

            return (
              <div
                key={slotIdx}
                className="p-3 rounded-lg bg-slate-800/95 border border-slate-600 hover:border-slate-400 transition-all shadow-sm space-y-2 relative group"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-100 flex items-center space-x-1.5">
                    <span className="text-emerald-400">#{slotIdx + 1}</span>
                    <span>{inc.title.substring(0, 20)}...</span>
                  </span>
                  {/* Remove button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(inc.id);
                    }}
                    title="Remove from selection"
                    className="w-5 h-5 rounded-full bg-slate-700 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1 text-[11px] font-mono">
                  <div>
                    <div className="text-[9px] text-slate-400 uppercase">Score</div>
                    <div className="font-bold text-white text-sm">
                      {inc.display_score.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-400 uppercase">Pop</div>
                    <div className="font-semibold text-sky-300">
                      {(inc.context.population_exposed / 1000).toFixed(1)}k
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-400 uppercase">Hosp</div>
                    <div className="font-semibold text-emerald-300">
                      {inc.context.hospital_count}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-700 text-[10px] text-slate-400">
                  <span className="text-emerald-400 font-semibold">✓ SELECTED</span>
                  <span>ID: {inc.id}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
