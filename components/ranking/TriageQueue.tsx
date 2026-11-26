'use client';

import React from 'react';
import { IncidentWithContext, ExperimentVariant } from '@/types';
import IncidentCard from '@/components/incidents/IncidentCard';

interface TriageQueueProps {
  incidents: IncidentWithContext[];
  variant: ExperimentVariant;
  selectedIds: number[];
  onToggleIncident: (id: number) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  timeExpired: boolean;
}

export default function TriageQueue({
  incidents,
  variant,
  selectedIds,
  onToggleIncident,
  onSubmit,
  isSubmitting,
  timeExpired,
}: TriageQueueProps) {
  const isComplete = selectedIds.length === 3;

  return (
    <div className="flex flex-col h-full bg-[#080c14] border-l border-[#1c2436] font-mono select-none">
      {/* Control Panel Header */}
      <div className="p-3 border-b border-[#1c2436] bg-[#0b101c] space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 bg-[#00d084] rounded-full inline-block"></span>
            <span>INCIDENT QUEUE</span>
          </span>
          <span className="text-slate-400 font-mono text-[10px]">
            TOTAL: 25 | READY: 25
          </span>
        </div>

        {/* Algorithm Formulation Badge */}
        <div className="p-2 rounded-[2px] bg-[#070b13] border border-[#1b2537] text-[10px] space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span>STRATEGY FORMULATION</span>
            <span
              className={`font-bold px-1 rounded ${
                variant === 'spatial_impact'
                  ? 'bg-sky-950 text-sky-400 border border-sky-800'
                  : 'bg-amber-950 text-amber-400 border border-amber-800'
              }`}
            >
              {variant === 'spatial_impact' ? 'S_B = Sev × (0.55 + 0.45·C)' : 'S_A = Raw Severity'}
            </span>
          </div>
          <div className="text-slate-400 text-[9px] leading-tight font-sans">
            {variant === 'spatial_impact'
              ? 'Multi-criteria: 60% Population + 30% Facilities + 10% Road Accessibility.'
              : 'Strict technical ranking: ordered by isolated engineering severity rating.'}
          </div>
        </div>
      </div>

      {/* Incident Stream (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-[#060910]">
        {incidents.map((inc) => (
          <IncidentCard
            key={inc.id}
            incident={inc}
            rank={inc.display_rank}
            isSelected={selectedIds.includes(inc.id)}
            onToggle={onToggleIncident}
            variant={variant}
          />
        ))}
      </div>

      {/* Action Footer & Dispatch Lock */}
      <div className="p-3 border-t border-[#1c2436] bg-[#0b101c] space-y-2.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400 uppercase text-[10px]">DISPATCH SLOTS:</span>
          <span
            className={`font-bold text-xs ${
              isComplete ? 'text-[#00d084]' : 'text-amber-400'
            }`}
          >
            {selectedIds.length} OF 3 ASSIGNED
          </span>
        </div>

        {/* Selected Quick Strip */}
        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
          {[0, 1, 2].map((slotIdx) => {
            const id = selectedIds[slotIdx];
            const inc = id ? incidents.find((i) => i.id === id) : null;
            return (
              <div
                key={slotIdx}
                className={`py-1 rounded-[2px] border ${
                  inc
                    ? 'border-[#00d084]/50 bg-[#00d084]/10 text-slate-100 font-bold'
                    : 'border-[#1b2537] bg-[#070b13] text-slate-600'
                }`}
              >
                {inc ? `#${inc.display_rank} [ID:${inc.id}]` : `SLOT ${slotIdx + 1}`}
              </div>
            );
          })}
        </div>

        <button
          onClick={onSubmit}
          disabled={!isComplete || isSubmitting || timeExpired}
          className={`w-full py-2.5 rounded-[2px] font-mono text-[11px] font-bold tracking-widest transition-all ${
            isComplete && !timeExpired && !isSubmitting
              ? 'bg-[#00d084] hover:bg-[#00d084]/90 text-black shadow-[0_0_15px_rgba(0,208,132,0.25)] cursor-pointer'
              : 'bg-[#121927] text-slate-600 cursor-not-allowed border border-[#1b2537]'
          }`}
        >
          {timeExpired
            ? 'TIMED OUT // DISPATCH LOCKED'
            : isSubmitting
            ? 'COMPUTING BENCHMARK...'
            : isComplete
            ? 'CONFIRM & DISPATCH UNITS (3/3)'
            : `ASSIGN ${3 - selectedIds.length} MORE TARGETS`}
        </button>
      </div>
    </div>
  );
}
