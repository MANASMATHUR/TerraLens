'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { IncidentWithContext, ExperimentVariant } from '@/types';

interface LayerVisibility {
  populationHeatmap?: boolean;
  facilities?: boolean;
  impactRadius?: boolean;
  distanceRings?: boolean;
  boundary?: boolean;
  clustering?: boolean;
}

interface JaipurMapProps {
  incidents: IncidentWithContext[];
  selectedIds: number[];
  onIncidentClick: (id: number) => void;
  variant: ExperimentVariant;
  activeFocusedId?: number | null;
  onIncidentHover?: (id: number | null) => void;
  layerVisibility?: LayerVisibility;
}

export default function JaipurMap({
  incidents,
  selectedIds,
  onIncidentClick,
  variant,
  activeFocusedId,
  onIncidentHover,
  layerVisibility = {
    populationHeatmap: true,
    facilities: true,
    impactRadius: true,
    distanceRings: true,
    boundary: true,
    clustering: true,
  },
}: JaipurMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [id: number]: L.Marker }>({});
  const circlesRef = useRef<{ [id: number]: L.Circle }>({});
  const layersGroupRef = useRef<{
    facilities?: L.GeoJSON;
    boundary?: L.GeoJSON;
    rings?: L.GeoJSON;
    heatmap?: L.GeoJSON;
  }>({});

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Jaipur center [lat, lng]
    const map = L.map(mapContainer.current, {
      center: [26.9124, 75.7873],
      zoom: 12,
      zoomControl: false,
    });

    // High-contrast OpenStreetMap cartographic base
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors | TerraLens GIS',
      subdomains: 'abc',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    // 1. Boundary
    fetch('/geo/jaipur_boundary.geojson')
      .then((r) => r.json())
      .then((data) => {
        const lyr = L.geoJSON(data, {
          style: {
            color: '#0284C7',
            weight: 2,
            dashArray: '5, 5',
            fillOpacity: 0.02,
          },
        }).addTo(map);
        layersGroupRef.current.boundary = lyr;
      })
      .catch(() => {});

    // 2. Distance Rings
    fetch('/geo/jaipur_distance_rings.geojson')
      .then((r) => r.json())
      .then((data) => {
        const lyr = L.geoJSON(data, {
          style: {
            color: '#64748B',
            weight: 1,
            dashArray: '3, 4',
            fillOpacity: 0.0,
          },
        }).addTo(map);
        layersGroupRef.current.rings = lyr;
      })
      .catch(() => {});

    // 3. Population Hexgrid (Density Heatmap)
    fetch('/geo/jaipur_population_hexgrid.geojson')
      .then((r) => r.json())
      .then((data) => {
        const lyr = L.geoJSON(data, {
          style: (feat) => {
            const density = feat?.properties?.density || 0;
            const color =
              density > 0.7
                ? '#DC2626'
                : density > 0.4
                ? '#EA580C'
                : density > 0.2
                ? '#CA8A04'
                : '#3B82F6';
            return {
              fillColor: color,
              fillOpacity: density * 0.35,
              weight: 0.5,
              color: '#FFFFFF',
              opacity: 0.2,
            };
          },
        }).addTo(map);
        layersGroupRef.current.heatmap = lyr;
      })
      .catch(() => {});

    // 4. Critical Facilities (Hospitals, fire, schools)
    fetch('/geo/facilities.geojson')
      .then((res) => res.json())
      .then((data) => {
        const lyr = L.geoJSON(data, {
          pointToLayer: (feature, latlng) => {
            const type = feature?.properties?.asset_type || 'facility';
            const color = type === 'hospital' ? '#EC4899' : type === 'fire_station' ? '#F97316' : '#EAB308';
            return L.circleMarker(latlng, {
              radius: 5,
              fillColor: color,
              color: '#FFFFFF',
              weight: 1.5,
              opacity: 1,
              fillOpacity: 0.9,
            }).bindTooltip(
              `<strong>${feature?.properties?.name || 'Facility'}</strong><br/><span style="text-transform:capitalize">${type}</span>`,
              { direction: 'top' }
            );
          },
        }).addTo(map);
        layersGroupRef.current.facilities = lyr;
      })
      .catch(() => {});

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Markers & Impact Buffers
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Clear old markers & circles
    Object.values(markersRef.current).forEach((m) => m.remove());
    Object.values(circlesRef.current).forEach((c) => c.remove());
    markersRef.current = {};
    circlesRef.current = {};

    incidents.forEach((inc) => {
      const lat = inc.geometry?.coordinates ? inc.geometry.coordinates[1] : 26.9124;
      const lng = inc.geometry?.coordinates ? inc.geometry.coordinates[0] : 75.7873;
      const isSelected = selectedIds.includes(inc.id);
      const isHovered = activeFocusedId === inc.id;

      // Color coding: Selected = crisp blue (#0284C7), Hovered = bright amber (#D97706), Default = emergency red (#DC2626)
      const bgColor = isSelected ? '#0284C7' : isHovered ? '#D97706' : '#DC2626';
      const scale = isHovered || isSelected ? 'scale(1.15)' : 'scale(1.0)';
      const zIndex = isHovered ? 1000 : isSelected ? 900 : 100;

      // Create Custom HTML Pin Icon
      const icon = L.divIcon({
        className: 'custom-leaflet-pin',
        iconSize: [60, 24],
        iconAnchor: [30, 12],
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            background-color: ${bgColor};
            color: #FFFFFF;
            padding: 3px 6px;
            border-radius: 4px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 11px;
            font-weight: 700;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            border: 1.5px solid #FFFFFF;
            transform: ${scale};
            transition: all 0.15s ease-out;
            cursor: pointer;
            z-index: ${zIndex};
          ">
            <span>#${inc.id.toString().padStart(2, '0')}</span>
            <span style="font-size: 9px; opacity: 0.9; font-family: monospace;">${inc.display_score.toFixed(0)}</span>
          </div>
        `,
      });

      const marker = L.marker([lat, lng], { icon }).addTo(map);

      // Impact Radius buffer circle
      const circle = L.circle([lat, lng], {
        radius: inc.impact_radius_m || 800,
        color: isSelected ? '#0284C7' : isHovered ? '#D97706' : '#DC2626',
        fillColor: isSelected ? '#0284C7' : isHovered ? '#D97706' : '#DC2626',
        fillOpacity: isHovered ? 0.25 : isSelected ? 0.18 : 0.08,
        weight: isHovered ? 2 : isSelected ? 1.5 : 0.8,
        dashArray: isSelected ? undefined : '4, 4',
      }).addTo(map);

      // Tooltip on marker
      marker.bindTooltip(
        `<strong>#${inc.id} ${inc.title}</strong><br/>` +
        `Strategy Score: <b>${inc.display_score.toFixed(1)}</b> | Sev: ${inc.severity_score}/100<br/>` +
        `Exposed Pop: ${(inc.context.population_exposed / 1000).toFixed(1)}k | Hosps: ${inc.context.hospital_count}`,
        { direction: 'top', offset: [0, -12] }
      );

      marker.on('click', () => {
        onIncidentClick(inc.id);
      });

      marker.on('mouseover', () => {
        if (onIncidentHover) onIncidentHover(inc.id);
      });

      marker.on('mouseout', () => {
        if (onIncidentHover) onIncidentHover(null);
      });

      markersRef.current[inc.id] = marker;
      circlesRef.current[inc.id] = circle;
    });
  }, [incidents, selectedIds, activeFocusedId, onIncidentClick, onIncidentHover]);

  // Center or pan when activeFocusedId changes
  useEffect(() => {
    if (!mapRef.current || !activeFocusedId) return;
    const targetInc = incidents.find((i) => i.id === activeFocusedId);
    if (targetInc && targetInc.geometry?.coordinates) {
      const lat = targetInc.geometry.coordinates[1];
      const lng = targetInc.geometry.coordinates[0];
      mapRef.current.panTo([lat, lng], { animate: true, duration: 0.5 });
    }
  }, [activeFocusedId, incidents]);

  return (
    <div className="w-full h-full relative bg-slate-900 overflow-hidden select-none">
      <div ref={mapContainer} className="w-full h-full z-0" />

      {/* Cartographic Legend (Docked bottom-left, clean enterprise dark theme) */}
      <div className="absolute bottom-4 left-4 px-3.5 py-3 rounded-lg border border-slate-700 bg-slate-900/90 backdrop-blur-md text-[11px] font-sans text-slate-200 space-y-2 shadow-xl z-10 pointer-events-none max-w-[220px]">
        <div className="text-[10px] uppercase font-mono font-bold tracking-wider text-sky-400 border-b border-slate-800 pb-1 flex justify-between">
          <span>JAIPUR GIS LAYERS</span>
          <span>WGS84</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded bg-[#0284C7] border border-white shadow-xs"></span>
          <span className="font-semibold text-white">Selected Dispatch (3)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded bg-[#DC2626] border border-white shadow-xs"></span>
          <span>Active Incident</span>
        </div>
        <div className="flex items-center space-x-3 text-[10px]">
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-[#EC4899]"></span>
            <span>Hospital</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-[#F97316]"></span>
            <span>Fire</span>
          </div>
        </div>
        <div className="text-[9px] font-mono text-slate-400 pt-1 border-t border-slate-800">
          Heatmap: Population Density Grid
        </div>
      </div>
    </div>
  );
}
