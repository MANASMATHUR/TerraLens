'use client';

import React from 'react';
import { IncidentWithContext, ExperimentVariant } from '@/types';
import { showSpatialContext } from '@/lib/experiment/gate';

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
  const allowSpatial = showSpatialContext(variant);

  const getTypeMeta = (type: string) => {
    switch (type) {
      case 'water_main_burst':
        return { code: 'WTR', label: 'Water Main' };
      case 'transformer_fire':
      case 'power_line_down':
        return { code: 'PWR', label: 'Power Grid' };
      case 'gas_leak':
      case 'pipeline_rupture':
        return { code: 'GAS', label: 'Gas Line' };
      case 'sinkhole':
        return { code: 'RDW', label: 'Road Cavity' };
      default:
        return { code: 'INC', label: 'Incident' };
    }
  };

  const meta = getTypeMeta(incident.incident_type);
  const severityScore = Number(incident.severity_score || 0);
  const severityPct = Math.min(100, Math.max(0, (severityScore / 100) * 100));

  return (
    <button
      type="button"
      onClick={() => onToggle(incident.id)}
      onMouseEnter={() => onHover?.(incident.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`w-full text-left p-3 rounded-[var(--radius-sm)] border select-none transition-all duration-150 relative cursor-pointer ${
        isSelected
          ? 'bg-[var(--surface)] border-[var(--border-hairline)] border-l-2 border-l-[var(--accent)] shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
          : isHovered
          ? 'bg-[var(--surface-raised)] border-[var(--accent)] shadow-xs'
          : 'bg-[var(--surface)] border-[var(--border-hairline)] hover:border-[var(--text-low)]'
      }`}
    >
      <div className="flex items-start justify-between gap-2.5">
        {/* Left: Rank Badge + Selection Check + Title & Severity Bar */}
        <div className="flex items-start space-x-2.5 min-w-0 flex-1">
          {/* Rank Badge */}
          <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--surface-raised)] border border-[var(--border-hairline)] flex items-center justify-center text-[11px] font-mono font-bold text-[var(--text-hi)] tabular-nums">
            #{rank}
          </span>

          {/* Selection indicator */}
          <div
            className={`mt-0.5 w-4 h-4 rounded-[4px] border flex items-center justify-center text-[10px] shrink-0 transition-colors ${
              isSelected
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white font-bold'
                : 'border-[var(--border-hairline)] bg-[var(--surface)]'
            }`}
          >
            {isSelected && '✓'}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-1.5 leading-tight">
              <span className="text-[10px] font-mono font-semibold px-1 py-0.5 rounded bg-[var(--surface-raised)] text-[var(--text-mid)]">
                {meta.code}
              </span>
              <span className="font-semibold text-[13px] text-[var(--text-hi)] truncate">
                {incident.title.split(' - ')[0]}
              </span>
            </div>

            {/* Severity 40px bar + Number */}
            <div className="mt-2 flex items-center space-x-2 text-[12px] text-[var(--text-mid)] font-mono">
              <span className="text-[11px] uppercase tracking-wider text-[var(--text-low)]">Sev</span>
              <div className="w-[40px] h-2 bg-[var(--surface-raised)] rounded-[2px] overflow-hidden border border-[var(--border-hairline)]">
                <div
                  className="h-full bg-[var(--warn)] rounded-[1px]"
                  style={{ width: `${severityPct}%` }}
                />
              </div>
              <span className="text-[var(--text-hi)] font-semibold tabular-nums">
                {severityScore.toFixed(0)}
              </span>

              {/* Gated spatial context chips: only rendered if variant is spatial_impact */}
              {allowSpatial && incident.context && (
                <>
                  <span className="text-[var(--border-hairline)]">|</span>
                  <span className="tabular-nums">
                    {(incident.context.population_exposed / 1000).toFixed(0)}k pop
                  </span>
                  {incident.context.hospital_count > 0 && (
                    <>
                      <span className="text-[var(--border-hairline)]">|</span>
                      <span className="text-[var(--bad)] font-semibold tabular-nums">
                        {incident.context.hospital_count} Hosp
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Score & Why Link */}
        <div className="text-right shrink-0 flex flex-col items-end justify-between">
          <div>
            <div className="font-mono text-[13px] font-bold text-[var(--text-hi)] tabular-nums">
              {incident.display_score.toFixed(1)}
            </div>
            <div className="text-[10px] text-[var(--text-low)] font-mono uppercase">
              {variant === 'spatial_impact' ? 'S_B' : 'S_A'}
            </div>
          </div>

          {allowSpatial && onInspectWhy && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onInspectWhy(incident);
              }}
              title="Inspect context breakdown"
              className="mt-1 text-[11px] font-sans font-medium text-[var(--accent)] hover:underline inline-flex items-center space-x-0.5 cursor-pointer"
            >
              <span>Why?</span>
              <span className="text-[9px]">ⓘ</span>
            </button>
          )}
        </div>
      </div>
    </button>
  );
}
