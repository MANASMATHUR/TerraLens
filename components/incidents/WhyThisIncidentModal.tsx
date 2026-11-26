'use client';

import React from 'react';
import { IncidentWithContext, ExperimentVariant } from '@/types';

interface WhyThisIncidentModalProps {
  incident: IncidentWithContext | null;
  variant: ExperimentVariant;
  isOpen: boolean;
  onClose: () => void;
}

export default function WhyThisIncidentModal({
  incident,
  variant,
  isOpen,
  onClose,
}: WhyThisIncidentModalProps) {
  if (!isOpen || !incident) return null;

  const P = incident.context.population_index;
  const F = incident.context.facility_index;
  const A = incident.context.accessibility_index;
  const C = 0.60 * P + 0.30 * F + 0.10 * A;
  const severity = incident.severity_score;
  const spatialScore = severity * (0.55 + 0.45 * C);

  const getPopulationLevel = (pop: number) => {
    if (pop >= 15000) return { label: 'High Exposure', color: 'text-rose-600 bg-rose-50 border-rose-200' };
    if (pop >= 6000) return { label: 'Moderate Exposure', color: 'text-amber-600 bg-amber-50 border-amber-200' };
    return { label: 'Low Exposure', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
  };

  const getFacilityLevel = (hospitals: number, fire: number) => {
    const total = hospitals + fire;
    if (total >= 2) return { label: `${total} Critical Facilities`, color: 'text-rose-600 bg-rose-50 border-rose-200' };
    if (total === 1) return { label: '1 Critical Facility', color: 'text-amber-600 bg-amber-50 border-amber-200' };
    return { label: 'No Critical Facilities', color: 'text-slate-500 bg-slate-50 border-slate-200' };
  };

  const getAccessLevel = (distM: number) => {
    if (distM > 100) return { label: 'High Isolation (>100m)', color: 'text-rose-600 bg-rose-50 border-rose-200' };
    if (distM > 35) return { label: 'Moderate Access', color: 'text-amber-600 bg-amber-50 border-amber-200' };
    return { label: 'Immediate Access (≤35m)', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
  };

  const popMeta = getPopulationLevel(incident.context.population_exposed);
  const facMeta = getFacilityLevel(incident.context.hospital_count, incident.context.fire_station_count);
  const accMeta = getAccessLevel(incident.context.nearest_road_distance_m);

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                INCIDENT EXPLAINABILITY
              </span>
              <span
                className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                  variant === 'spatial_impact'
                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {variant === 'spatial_impact' ? 'Treatment Arm (S_B)' : 'Control Arm (S_A)'}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-1">
              #{incident.id.toString().padStart(2, '0')} {incident.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1 rounded-md hover:bg-slate-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Narrative Box */}
        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 space-y-1.5">
          <div className="font-bold text-slate-900 flex items-center justify-between">
            <span>Why this queue position?</span>
            <span className="font-mono text-[11px] text-slate-500">
              Display Rank: #{incident.display_rank} of 25
            </span>
          </div>
          <p className="leading-relaxed">
            {variant === 'spatial_impact' ? (
              <>
                Under the <strong>Spatial-Impact Strategy (S_B)</strong>, this incident is prioritized by combining
                technical engineering severity with geospatial disruption amplifiers. High population exposure
                and adjacent emergency facilities multiply the severity score from{' '}
                <span className="font-mono font-bold text-slate-900">{severity.toFixed(1)}</span> to an effective impact of{' '}
                <span className="font-mono font-bold text-sky-700">{spatialScore.toFixed(1)}</span>.
              </>
            ) : (
              <>
                Under the <strong>Severity-Only Strategy (S_A)</strong>, this incident is prioritized strictly
                by its raw engineering severity score of{' '}
                <span className="font-mono font-bold text-amber-700">{severity.toFixed(1)} / 100</span>.
                Surrounding population density and infrastructure cascade risks are not weighted into its ranking.
              </>
            )}
          </p>
        </div>

        {/* Breakdown Parameters */}
        <div className="space-y-2.5">
          <div className="text-[11px] uppercase font-mono font-bold text-slate-500 tracking-wider">
            PRIMARY SCORING COMPONENTS
          </div>

          <div className="space-y-2">
            {/* 1. Engineering Severity */}
            <div className="p-2.5 rounded-md border border-slate-200 bg-white space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">1. Technical Equipment Severity</span>
                <span className="font-mono font-bold text-slate-900">{severity.toFixed(0)} / 100</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full"
                  style={{ width: `${Math.min(100, severity)}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500 flex justify-between font-mono">
                <span>SCADA sensor alarms & failure threshold</span>
                <span>{variant === 'severity_only' ? '100% of Queue Rank' : 'Base Multiplicand'}</span>
              </div>
            </div>

            {/* 2. Population Exposure */}
            <div className="p-2.5 rounded-md border border-slate-200 bg-white space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">2. Population in Impact Radius</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold ${popMeta.color}`}>
                  {popMeta.label}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 flex justify-between font-mono pt-0.5">
                <span>Estimated Population Exposure (Synthetic Model): {incident.context.population_exposed.toLocaleString()} residents</span>
                <span>Norm Index: P = {P.toFixed(2)}</span>
              </div>
            </div>

            {/* 3. Critical Facilities */}
            <div className="p-2.5 rounded-md border border-slate-200 bg-white space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">3. Adjacent Critical Facilities</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold ${facMeta.color}`}>
                  {facMeta.label}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 flex justify-between font-mono pt-0.5">
                <span>
                  {incident.context.hospital_count} Hospital(s), {incident.context.fire_station_count} Fire Station(s)
                </span>
                <span>Norm Index: F = {F.toFixed(2)}</span>
              </div>
            </div>

            {/* 4. Accessibility */}
            <div className="p-2.5 rounded-md border border-slate-200 bg-white space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">4. Road Network Reachability</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold ${accMeta.color}`}>
                  {accMeta.label}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 flex justify-between font-mono pt-0.5">
                <span>{incident.context.nearest_road_distance_m.toFixed(0)}m to primary road</span>
                <span>Norm Index: A = {A.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Formula Comparison Footer */}
        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <div className="space-y-0.5">
            <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">
              FORMULA COMPARISON
            </div>
            <div className="font-mono text-xs text-slate-700">
              S_A = {severity.toFixed(1)} pts vs S_B = {spatialScore.toFixed(1)} pts
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs shadow-xs transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
