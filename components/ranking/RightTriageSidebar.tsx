'use client';

import React, { useState } from 'react';
import { IncidentWithContext, ExperimentVariant } from '@/types';
import { showSpatialContext } from '@/lib/experiment/gate';

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
  onClose?: () => void;
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
  onClose,
}: RightTriageSidebarProps) {
  const isComplete = selectedIds.length === 3;
  const allowSpatial = showSpatialContext(variant);

  const activeIncident =
    focusedIncident ||
    (selectedIds.length > 0
      ? incidents.find((i) => i.id === selectedIds[selectedIds.length - 1]) || incidents[0]
      : incidents[0]);

  const ctx = activeIncident?.context;
  const popIndex = Number(ctx?.population_index ?? 0);
  const facIndex = Number(ctx?.facility_index ?? 0);
  const accIndex = Number(ctx?.accessibility_index ?? 0);

  return (
    <aside className="w-full h-full bg-[var(--surface)] border-l border-[var(--border-hairline)] flex flex-col justify-between select-none z-30 text-[var(--text-hi)] text-[12px] shadow-[var(--shadow-floating)] transition-all">
      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        {/* Panel Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border-hairline)]">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-mid)] font-bold">
            CONTEXT INSPECTION
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] font-mono px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] hover:bg-[var(--surface)] text-[var(--text-mid)] font-semibold transition-colors cursor-pointer"
            >
              ✕ Close
            </button>
          )}
        </div>

        {/* Selected Incident Details */}
        {activeIncident ? (
          <div className="space-y-3">
            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] border border-[var(--border-hairline)] space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-mid)]">
                <span className="font-bold text-[var(--text-hi)]">
                  #{activeIncident.id.toString().padStart(2, '0')}
                </span>
                <span className="tabular-nums font-semibold">
                  Severity: {activeIncident.severity_score.toFixed(1)}/100
                </span>
              </div>
              <h3 className="font-semibold text-[13px] text-[var(--text-hi)] leading-snug">
                {activeIncident.title}
              </h3>
              <p className="text-[11px] text-[var(--text-mid)] leading-relaxed">
                {activeIncident.description}
              </p>
            </div>

            {/* Context Breakdown - Spec 1.2.9: three 0..1 bars only where arm permits */}
            {allowSpatial && ctx ? (
              <div className="space-y-3 p-3 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--border-hairline)]">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-mid)] font-bold">
                  Context Breakdown (0..1)
                </div>

                {/* Population Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--text-hi)] font-medium">Population Exposure</span>
                    <span className="font-mono text-[var(--text-mid)] tabular-nums">
                      {popIndex.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[var(--surface-raised)] rounded-[2px] overflow-hidden border border-[var(--border-hairline)]">
                    <div
                      className="h-full bg-[var(--accent)] rounded-[1px] transition-all duration-200"
                      style={{ width: `${Math.min(100, Math.max(0, popIndex * 100))}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[var(--text-low)] tabular-nums font-mono">
                    ~{(ctx.population_exposed / 1000).toFixed(0)}k residents in outage zone
                  </span>
                </div>

                {/* Facility Vulnerability Bar */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--text-hi)] font-medium">Facility Proximity</span>
                    <span className="font-mono text-[var(--text-mid)] tabular-nums">
                      {facIndex.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[var(--surface-raised)] rounded-[2px] overflow-hidden border border-[var(--border-hairline)]">
                    <div
                      className="h-full bg-[var(--bad)] rounded-[1px] transition-all duration-200"
                      style={{ width: `${Math.min(100, Math.max(0, facIndex * 100))}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[var(--text-low)] tabular-nums font-mono">
                    {ctx.hospital_count} hospitals, {ctx.fire_station_count} fire stations
                  </span>
                </div>

                {/* Road Access Degradation Bar */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--text-hi)] font-medium">Road Accessibility Deficit</span>
                    <span className="font-mono text-[var(--text-mid)] tabular-nums">
                      {accIndex.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[var(--surface-raised)] rounded-[2px] overflow-hidden border border-[var(--border-hairline)]">
                    <div
                      className="h-full bg-[var(--warn)] rounded-[1px] transition-all duration-200"
                      style={{ width: `${Math.min(100, Math.max(0, accIndex * 100))}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[var(--text-low)] font-mono">
                    Isolation index: {accIndex.toFixed(2)} ({accIndex > 0.6 ? 'Severe' : accIndex > 0.3 ? 'Moderate' : 'Low'} delay)
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] border border-[var(--border-hairline)] text-center text-[11px] text-[var(--text-mid)]">
                Control arm strategy (S_A): Prioritization strictly evaluated by SCADA telemetry severity.
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 text-center text-[var(--text-low)]">No incident selected</div>
        )}
      </div>

      {/* Dispatch Submission Action Footer */}
      <div className="p-4 border-t border-[var(--border-hairline)] bg-[var(--surface)] space-y-2 shrink-0">
        <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-mid)]">
          <span>Remaining: {timeFormatted}</span>
          <span className="tabular-nums font-bold text-[var(--text-hi)]">{selectedIds.length}/3 selected</span>
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!isComplete || isSubmitting || timeExpired}
          className={`w-full py-2.5 px-3 rounded-[var(--radius-sm)] text-[12px] font-bold text-center transition-all cursor-pointer ${
            isComplete && !timeExpired && !isSubmitting
              ? 'bg-[var(--accent)] text-white hover:opacity-90 shadow-xs'
              : 'bg-[var(--surface-raised)] text-[var(--text-low)] border border-[var(--border-hairline)] cursor-not-allowed'
          }`}
        >
          {isComplete ? 'Review & Submit Dispatch' : 'Pick 3 to submit'}
        </button>
      </div>
    </aside>
  );
}
