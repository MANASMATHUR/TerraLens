'use client';

import React, { useState } from 'react';
import { IncidentWithContext, ExperimentVariant } from '@/types';
import IncidentCard from '@/components/incidents/IncidentCard';

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
  const { incidents, variant, selectedIds, activeFocusedId, onToggleIncident, onHoverIncident, onInspectWhy,
    layerVisibility, onToggleLayer, populationOpacity, onPopulationOpacityChange, isCollapsed, onToggleCollapsed } = props;
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [layersCollapsed, setLayersCollapsed] = useState(true);
  const filtered = incidents.filter((inc) => {
    const matches = inc.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      inc.incident_type.toLowerCase().includes(searchFilter.toLowerCase()) || inc.id.toString().includes(searchFilter);
    if (typeFilter === 'all') return matches;
    if (typeFilter === 'water') return matches && inc.incident_type.includes('water');
    if (typeFilter === 'power') return matches && (inc.incident_type.includes('power') || inc.incident_type.includes('transformer'));
    if (typeFilter === 'gas') return matches && (inc.incident_type.includes('gas') || inc.incident_type.includes('pipeline'));
    if (typeFilter === 'road') return matches && inc.incident_type.includes('sinkhole');
    return matches;
  });

  if (isCollapsed) return <aside className="w-10 md:w-12 h-full shrink-0 border-r border-slate-800 bg-slate-950 text-slate-200 z-30 flex flex-col items-center py-3 gap-3 shadow-lg">
    <button onClick={onToggleCollapsed} title="Open incidents and layers stream" className="h-8 w-8 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold flex items-center justify-center cursor-pointer transition-colors shadow">›</button>
    <div className="flex flex-col items-center gap-1.5 my-1">
      <span className="text-[10px] font-mono font-bold text-sky-300 bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800/60">{selectedIds.length}/3</span>
    </div>
    <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] tracking-widest text-slate-400 font-mono">INCIDENTS ({filtered.length})</span>
  </aside>;

  const toggles: [keyof LayerVisibilityState, string][] = [
    ['hospitals', 'Hospitals'], ['fireStations', 'Fire stations'], ['schools', 'Schools'], ['roads', 'Roads'],
    ['impactRadius', 'Incident impact radius'], ['boundary', 'Approximate city boundary'],
  ];
  return <aside className="absolute inset-y-0 left-0 w-[min(90vw,320px)] md:relative md:w-80 h-full bg-slate-950 border-r border-slate-800 flex flex-col select-none shrink-0 z-30 text-slate-100 shadow-2xl transition-all">
    <div className="p-2.5 border-b border-slate-800 bg-slate-900 space-y-2 shrink-0">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[11px] font-bold tracking-tight text-slate-100 flex items-center gap-1.5">
          <span>INCIDENT STREAM</span>
          <span className="text-slate-400 font-mono font-normal">({filtered.length})</span>
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono font-bold text-sky-200 bg-sky-950 px-2 py-0.5 rounded border border-sky-800/50">{selectedIds.length}/3</span>
          <button onClick={onToggleCollapsed} title="Collapse incident stream to see full map" className="h-7 w-7 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white flex items-center justify-center cursor-pointer font-bold transition-colors">‹</button>
        </div>
      </div>
      <input type="search" placeholder="Search by ID, name, or type" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500" />
      <div className="flex gap-1 overflow-x-auto pb-0.5 text-[10px] font-mono font-semibold">{[['all','All'],['water','Water'],['power','Power'],['gas','Gas'],['road','Road']].map(([id,label]) =>
        <button key={id} onClick={() => setTypeFilter(id)} className={`px-2 py-0.5 rounded whitespace-nowrap cursor-pointer transition-colors ${typeFilter === id ? 'bg-sky-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}>{label}</button>)}</div>
      
      {/* Collapsible Map Layers Accordion */}
      <section className="pt-1.5 border-t border-slate-800">
        <button
          type="button"
          onClick={() => setLayersCollapsed(!layersCollapsed)}
          className="w-full flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400 hover:text-slate-200 cursor-pointer py-0.5"
        >
          <span>Map layers toggles</span>
          <span className="text-[9px] text-slate-500">{layersCollapsed ? '▼' : '▲'}</span>
        </button>
        {!layersCollapsed && (
          <div className="mt-1.5 p-2 rounded-md bg-slate-950 border border-slate-800 space-y-2 text-[11px] text-slate-300">
            <label className="flex items-center gap-2"><input type="checkbox" checked={layerVisibility.populationHeatmap} onChange={() => onToggleLayer('populationHeatmap')} className="accent-sky-500 cursor-pointer" /><span>Synthetic population density</span></label>
            <label className="flex items-center gap-2 pl-5 text-[10px] text-slate-400">Opacity <input aria-label="Population layer opacity" type="range" min="0" max="100" value={populationOpacity} onChange={(e) => onPopulationOpacityChange(Number(e.target.value))} className="w-full accent-sky-500 cursor-pointer" /><span className="w-8 text-right font-mono">{populationOpacity}%</span></label>
            {toggles.map(([key, label]) => <label key={key} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={layerVisibility[key]} onChange={() => onToggleLayer(key)} className="accent-sky-500 cursor-pointer" /><span>{label}</span></label>)}
          </div>
        )}
      </section>
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 bg-slate-950">{filtered.length === 0 ? <div className="p-4 text-center text-xs text-slate-400">No incidents matching filter.</div> : filtered.map((inc) => <IncidentCard key={inc.id} incident={inc} rank={inc.display_rank} isSelected={selectedIds.includes(inc.id)} isHovered={activeFocusedId === inc.id} onToggle={onToggleIncident} onHover={onHoverIncident} onInspectWhy={onInspectWhy} variant={variant} />)}</div>
    <div className="p-2 border-t border-slate-800 bg-slate-900 text-[10px] text-slate-400 font-mono flex items-center justify-between shrink-0"><span>SORT: {variant === 'spatial_impact' ? 'SPATIAL (S_B)' : 'SEVERITY (S_A)'}</span><span>{incidents.length} TOTAL</span></div>
  </aside>;
}
