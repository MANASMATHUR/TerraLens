'use client';

import React, { useState } from 'react';
import { IncidentWithContext, ExperimentVariant } from '@/types';
import IncidentCard from '@/components/incidents/IncidentCard';
import { showSpatialContext } from '@/lib/experiment/gate';

export interface LayerVisibilityState {
  populationHeatmap: boolean;
  hospitals: boolean;
  fireStations: boolean;
  schools: boolean;
  roads: boolean;
  impactRadius: boolean;
  boundary: boolean;
}

interface LeftIncidentPanelProps {
  incidents: IncidentWithContext[];
  variant: ExperimentVariant;
  selectedIds: number[];
  activeFocusedId: number | null;
  onToggleIncident: (id: number) => void;
  onHoverIncident: (id: number | null) => void;
  onInspectWhy?: (incident: IncidentWithContext) => void;
  layerVisibility: LayerVisibilityState;
  onToggleLayer: (layerKey: keyof LayerVisibilityState) => void;
  populationOpacity: number;
  onPopulationOpacityChange: (value: number) => void;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function LeftIncidentPanel(props: LeftIncidentPanelProps) {
  const {
    incidents,
    variant,
    selectedIds,
    activeFocusedId,
    onToggleIncident,
    onHoverIncident,
    onInspectWhy,
    layerVisibility,
    onToggleLayer,
    populationOpacity,
    onPopulationOpacityChange,
    isCollapsed,
    onToggleCollapsed,
  } = props;

  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [layersCollapsed, setLayersCollapsed] = useState(true);

  const filtered = incidents.filter((inc) => {
    const matches =
      inc.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      inc.incident_type.toLowerCase().includes(searchFilter.toLowerCase()) ||
      inc.id.toString().includes(searchFilter);
    if (typeFilter === 'all') return matches;
    if (typeFilter === 'water') return matches && inc.incident_type.includes('water');
    if (typeFilter === 'power') return matches && (inc.incident_type.includes('power') || inc.incident_type.includes('transformer'));
    if (typeFilter === 'gas') return matches && (inc.incident_type.includes('gas') || inc.incident_type.includes('pipeline'));
    if (typeFilter === 'road') return matches && inc.incident_type.includes('sinkhole');
    return matches;
  });

  const allowSpatial = showSpatialContext(variant);

  if (isCollapsed) {
    return (
      <aside className="w-10 md:w-12 h-full shrink-0 border-r border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--text-hi)] z-20 flex flex-col items-center py-3 gap-3 shadow-xs">
        <button
          type="button"
          onClick={onToggleCollapsed}
          title="Open incident stream"
          className="h-8 w-8 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] border border-[var(--border-hairline)] hover:bg-[var(--surface)] text-[var(--text-hi)] font-bold flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
        >
          ›
        </button>
        <div className="flex flex-col items-center gap-1.5 my-1">
          <span className="text-[11px] font-mono font-bold text-[var(--accent)] bg-[var(--surface-raised)] px-1.5 py-0.5 rounded-[4px] border border-[var(--border-hairline)] tabular-nums">
            {selectedIds.length}/3
          </span>
        </div>
        <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] tracking-widest text-[var(--text-low)] font-mono">
          INCIDENTS ({filtered.length})
        </span>
      </aside>
    );
  }

  const toggles: [keyof LayerVisibilityState, string][] = [
    ['hospitals', 'Hospitals'],
    ['fireStations', 'Fire stations'],
    ['schools', 'Schools'],
    ['roads', 'Roads'],
    ['impactRadius', 'Impact radius'],
    ['boundary', 'Jaipur boundary'],
  ];

  return (
    <aside className="w-full h-full bg-[var(--surface)] border-r border-[var(--border-hairline)] flex flex-col select-none shrink-0 z-20 text-[var(--text-hi)] transition-all">
      {/* Top Controls Header */}
      <div className="p-3 border-b border-[var(--border-hairline)] bg-[var(--surface)] space-y-2.5 shrink-0">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[12px] font-bold tracking-tight text-[var(--text-hi)] flex items-center gap-1.5">
            <span>INCIDENT STREAM</span>
            <span className="text-[var(--text-low)] font-mono font-normal tabular-nums">
              ({filtered.length})
            </span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-[var(--text-hi)] bg-[var(--surface-raised)] px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--border-hairline)] tabular-nums">
              {selectedIds.length}/3
            </span>
            <button
              type="button"
              onClick={onToggleCollapsed}
              title="Collapse list"
              className="h-7 w-7 rounded-[var(--radius-sm)] border border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-raised)] text-[var(--text-mid)] flex items-center justify-center cursor-pointer font-bold transition-colors"
            >
              ‹
            </button>
          </div>
        </div>

        {/* Filter input */}
        <input
          type="search"
          placeholder="Filter by ID, title, or type..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="w-full px-2.5 py-1.5 bg-[var(--surface-raised)] border border-[var(--border-hairline)] rounded-[var(--radius-sm)] text-[12px] text-[var(--text-hi)] placeholder-[var(--text-low)] focus:outline-none focus:border-[var(--accent)] transition-colors"
        />

        {/* Type Filter Pills */}
        <div className="flex gap-1 overflow-x-auto pb-0.5 text-[11px] font-mono font-medium">
          {[
            ['all', 'All'],
            ['water', 'Water'],
            ['power', 'Power'],
            ['gas', 'Gas'],
            ['road', 'Road'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTypeFilter(id)}
              className={`px-2.5 py-0.5 rounded-[var(--radius-sm)] whitespace-nowrap cursor-pointer transition-colors border ${
                typeFilter === id
                  ? 'bg-[var(--text-hi)] border-[var(--text-hi)] text-white'
                  : 'bg-[var(--surface)] border-[var(--border-hairline)] text-[var(--text-mid)] hover:bg-[var(--surface-raised)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Map Layers Accordion Toggle (Controlled by pill toggles per spec 1.2.6) */}
        <section className="pt-2 border-t border-[var(--border-hairline)]">
          <button
            type="button"
            onClick={() => setLayersCollapsed(!layersCollapsed)}
            className="w-full flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[var(--text-mid)] hover:text-[var(--text-hi)] cursor-pointer py-0.5"
          >
            <span>Layer Visibility Controls</span>
            <span className="text-[9px] text-[var(--text-low)]">{layersCollapsed ? '▼' : '▲'}</span>
          </button>
          {!layersCollapsed && (
            <div className="mt-2 p-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] border border-[var(--border-hairline)] space-y-2 text-[12px] text-[var(--text-mid)]">
              {allowSpatial && (
                <>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layerVisibility.populationHeatmap}
                      onChange={() => onToggleLayer('populationHeatmap')}
                      className="accent-[var(--accent)] cursor-pointer"
                    />
                    <span className="text-[var(--text-hi)]">Synthetic population density</span>
                  </label>
                  <label className="flex items-center gap-2 pl-5 text-[11px] text-[var(--text-mid)]">
                    Opacity
                    <input
                      aria-label="Population layer opacity"
                      type="range"
                      min="0"
                      max="100"
                      value={populationOpacity}
                      onChange={(e) => onPopulationOpacityChange(Number(e.target.value))}
                      className="w-full accent-[var(--accent)] cursor-pointer"
                    />
                    <span className="w-8 text-right font-mono tabular-nums">{populationOpacity}%</span>
                  </label>
                </>
              )}
              {toggles.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layerVisibility[key]}
                    onChange={() => onToggleLayer(key)}
                    className="accent-[var(--accent)] cursor-pointer"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Incident Cards Scrollable Container */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2 bg-[var(--bg)]">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--text-mid)]">
            No incidents matching filter. Try selecting 'All' or clearing search.
          </div>
        ) : (
          filtered.map((inc) => (
            <IncidentCard
              key={inc.id}
              incident={inc}
              rank={inc.display_rank}
              isSelected={selectedIds.includes(inc.id)}
              isHovered={activeFocusedId === inc.id}
              onToggle={onToggleIncident}
              onHover={onHoverIncident}
              onInspectWhy={onInspectWhy}
              variant={variant}
            />
          ))
        )}
      </div>

      {/* Footer Meta Row */}
      <div className="p-2.5 border-t border-[var(--border-hairline)] bg-[var(--surface)] text-[11px] text-[var(--text-mid)] font-mono flex items-center justify-between shrink-0">
        <span className="uppercase tracking-wider">
          SORT: {variant === 'spatial_impact' ? 'SPATIAL (S_B)' : 'SEVERITY (S_A)'}
        </span>
        <span className="tabular-nums font-semibold text-[var(--text-hi)]">
          {incidents.length} TOTAL
        </span>
      </div>
    </aside>
  );
}
