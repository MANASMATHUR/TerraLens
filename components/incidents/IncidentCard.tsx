'use client';

import React from 'react';
import { IncidentWithContext, ExperimentVariant } from '@/types';

interface IncidentCardProps {
  incident: IncidentWithContext;
  rank: number;
  isSelected: boolean;
  isHovered?: boolean;
  onToggle: (id: number) => void;
  onHover?: (id: number | null) => void;
  onInspectWhy?: (incident: IncidentWithContext) => void;
  variant: ExperimentVariant;
}

export default function IncidentCard({
  incident,
  rank,
  isSelected,
  isHovered = false,
  onToggle,
  onHover,
  onInspectWhy,
  variant,
}: IncidentCardProps) {
  const getTypeMeta = (type: string) => {
    switch (type) {
      case 'water_main_burst':
        return { code: 'WTR', label: 'Water Main' };
      case 'transformer_fire':
        return { code: 'PWR', label: 'Substation' };
      case 'power_line_down':
        return { code: 'PWR', label: 'Power Line' };
      case 'gas_leak':
        return { code: 'GAS', label: 'Gas Main' };
      case 'pipeline_rupture':
        return { code: 'PIP', label: 'Pipeline' };
      case 'sinkhole':
        return { code: 'RDW', label: 'Road Cavity' };
      default:
        return { code: 'INC', label: 'Incident' };
    }
  };

  const meta = getTypeMeta(incident.incident_type);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onToggle(incident.id);
      }}
      onMouseEnter={() => {
        if (onHover) onHover(incident.id);
      }}
      onMouseLeave={() => {
        if (onHover) onHover(null);
      }}
      className={`p-2.5 rounded-md border cursor-pointer select-none transition-all ${
        isSelected
          ? 'border-sky-600 bg-sky-50 shadow-xs ring-1 ring-sky-500'
          : isHovered
          ? 'border-amber-400 bg-amber-50/60 shadow-xs'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 shadow-2xs'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Left: Checkbox + Title */}
        <div className="flex items-start space-x-2.5 min-w-0">
          <div
            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center text-[10px] flex-shrink-0 transition-colors ${
              isSelected
                ? 'bg-sky-600 border-sky-600 text-white font-bold'
                : 'border-slate-300 bg-white'
            }`}
          >
            {isSelected && '✓'}
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-1.5 leading-tight">
              <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">
                {meta.code}
              </span>
              <span className="font-semibold text-xs text-slate-900 truncate">
                #{incident.id.toString().padStart(2, '0')} {incident.title.split(' - ')[0]}
              </span>
            </div>

            <div className="text-[11px] text-slate-500 mt-1 flex items-center space-x-2 font-mono">
              <span>Sev: {incident.severity_score.toFixed(0)}</span>
              <span className="text-slate-300">•</span>
              <span>{(incident.context.population_exposed / 1000).toFixed(1)}k pop</span>
              {incident.context.hospital_count > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-rose-600 font-sans font-semibold text-[10px]">
                    {incident.context.hospital_count} Hosp
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Score & Why Inspector */}
        <div className="text-right flex-shrink-0 flex flex-col items-end justify-between">
          <div>
            <div className="font-mono text-xs font-bold text-slate-900">
              {incident.display_score.toFixed(1)}
            </div>
            <div className="text-[9px] text-slate-400 font-mono uppercase">
              {variant === 'spatial_impact' ? 'S_B' : 'S_A'}
            </div>
          </div>
          {onInspectWhy && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onInspectWhy(incident);
              }}
              title="Inspect Why This Incident was Ranked Here"
              className="mt-1 text-[10px] font-sans font-medium text-sky-600 hover:text-sky-800 hover:underline inline-flex items-center space-x-0.5 cursor-pointer"
            >
              <span>Why?</span>
              <span className="text-[9px]">ⓘ</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
