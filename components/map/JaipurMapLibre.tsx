'use client';

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { IncidentWithContext, ExperimentVariant } from '@/types';
import { createCirclePolygon } from '@/lib/gis/geometry';
import { showSpatialContext } from '@/lib/experiment/gate';
import JaipurMap from '@/components/map/JaipurMap';

interface LayerVisibility {
  populationHeatmap: boolean;
  hospitals: boolean;
  fireStations: boolean;
  schools: boolean;
  roads: boolean;
  impactRadius: boolean;
  boundary: boolean;
}

interface JaipurMapLibreProps {
  incidents: IncidentWithContext[];
  selectedIds: number[];
  variant: ExperimentVariant;
  activeFocusedId?: number | null;
  onIncidentClick: (id: number) => void;
  onIncidentHover?: (id: number | null) => void;
  layerVisibility?: LayerVisibility;
  populationOpacity?: number;
  onToggleLayer?: (key: keyof LayerVisibility) => void;
}

const DEFAULT_LAYERS: LayerVisibility = {
  populationHeatmap: true,
  hospitals: false,
  fireStations: false,
  schools: false,
  roads: false,
  impactRadius: true,
  boundary: true,
};

// Jaipur center coordinates (WGS84)
const JAIPUR_CENTER: [number, number] = [75.7873, 26.9124];
const JAIPUR_BOUNDS: [[number, number], [number, number]] = [
  [75.60, 26.75], // Southwest
  [76.05, 27.10], // Northeast
];

export default function JaipurMapLibre({
  incidents,
  selectedIds,
  variant,
  activeFocusedId,
  onIncidentClick,
  onIncidentHover,
  layerVisibility = DEFAULT_LAYERS,
  populationOpacity = 60,
  onToggleLayer,
}: JaipurMapLibreProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [webglError, setWebglError] = useState(false);

  // Arm colour token resolution: control is slate, treatment is cyan
  const isTreatment = variant === 'spatial_impact';
  const armColor = isTreatment ? '#0284C7' : '#64748B'; // cyan or slate
  const allowSpatial = showSpatialContext(variant);

  // Initialize MapLibre GL map with OpenFreeMap Positron (light vector basemap)
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebglError(true);
        return;
      }
    } catch {
      setWebglError(true);
      return;
    }

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: mapContainer.current,
        style: 'https://tiles.openfreemap.org/styles/positron', // Section 1.2.1 light vector basemap
        center: JAIPUR_CENTER,
        zoom: 12.2,
        minZoom: 10,
        maxZoom: 18,
        maxBounds: JAIPUR_BOUNDS,
        attributionControl: false,
      });

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
        'top-right'
      );
      map.addControl(
        new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }),
        'bottom-left'
      );
      map.addControl(
        new maplibregl.AttributionControl({
          compact: true,
          customAttribution: '© OpenFreeMap © OpenStreetMap',
        }),
        'bottom-right'
      );

      map.on('styleimagemissing', (e) => {
        const id = e.id;
        if (!map.hasImage(id)) {
          map.addImage(id, {
            width: 1,
            height: 1,
            data: new Uint8Array([0, 0, 0, 0]),
          });
        }
      });

      map.on('load', async () => {
        // 1. Municipal Boundary
        try {
          const boundaryRes = await fetch('/geo/jaipur_boundary.geojson');
          if (boundaryRes.ok) {
            const boundaryData = await boundaryRes.json();
            map.addSource('jaipur-boundary-src', {
              type: 'geojson',
              data: boundaryData,
            });

            map.addLayer({
              id: 'jaipur-boundary-line',
              type: 'line',
              source: 'jaipur-boundary-src',
              paint: {
                'line-color': '#94A3B8',
                'line-width': 1.5,
                'line-dasharray': [4, 3],
                'line-opacity': 0.6,
              },
            });
          }
        } catch {}

        // 2. Synthetic population surface
        try {
          const hexRes = await fetch('/geo/jaipur_population_hexgrid.geojson');
          if (hexRes.ok) {
            const hexData = await hexRes.json();
            map.addSource('population-hexgrid-src', {
              type: 'geojson',
              data: hexData,
            });

            map.addLayer({
              id: 'population-heatmap-fill',
              type: 'fill',
              source: 'population-hexgrid-src',
              paint: {
                'fill-color': [
                  'interpolate',
                  ['linear'],
                  ['coalesce', ['to-number', ['get', 'density']], ['to-number', ['get', 'population_density_norm']], 0.0],
                  0.0, 'transparent',
                  0.1, '#F1F5F9',
                  0.3, '#BAE6FD',
                  0.6, '#38BDF8',
                  0.9, '#0284C7',
                ],
                'fill-opacity': 0.5,
              },
            });
          }
        } catch {}

        // 3. Reference Critical Facilities (Hospitals, Fire, Schools)
        try {
          const facRes = await fetch('/geo/facilities.geojson');
          if (facRes.ok) {
            const facData = await facRes.json();
            map.addSource('facilities-src', {
              type: 'geojson',
              data: facData,
            });

            map.addLayer({
              id: 'facilities-core',
              type: 'circle',
              source: 'facilities-src',
              filter: ['in', ['get', 'asset_type'], ['literal', ['hospital', 'fire_station', 'school']]],
              paint: {
                'circle-radius': 4,
                'circle-color': [
                  'match',
                  ['get', 'asset_type'],
                  'hospital', '#E11D48',
                  'fire_station', '#D97706',
                  'school', '#EAB308',
                  '#94A3B8',
                ],
                'circle-stroke-width': 1,
                'circle-stroke-color': '#FFFFFF',
              },
            });
          }
        } catch {}

        // 4. Impact radius fill per incident, opacity 0.08, coloured by arm (Spec 1.2.2)
        map.addSource('impact-radius-src', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addLayer({
          id: 'impact-radius-fill',
          type: 'fill',
          source: 'impact-radius-src',
          paint: {
            'fill-color': armColor,
            'fill-opacity': 0.08, // Spec 1.2.2: opacity 0.08
          },
        });

        map.addLayer({
          id: 'impact-radius-line',
          type: 'line',
          source: 'impact-radius-src',
          paint: {
            'line-color': armColor,
            'line-width': 1.5,
            'line-opacity': 0.4,
          },
        });

        // 5. Incidents Points Source
        map.addSource('incidents-src', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        // Spec 1.2.3: Glow circle radius 14 at opacity 0.18, coloured by arm
        map.addLayer({
          id: 'incidents-glow',
          type: 'circle',
          source: 'incidents-src',
          paint: {
            'circle-radius': 14,
            'circle-color': armColor,
            'circle-opacity': 0.18,
          },
        });

        // Spec 1.2.4: Selected 11px ring, 2px stroke
        map.addLayer({
          id: 'incidents-selected-ring',
          type: 'circle',
          source: 'incidents-src',
          filter: ['==', ['get', 'isSelected'], true],
          paint: {
            'circle-radius': 11,
            'circle-color': 'transparent',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#0EA5E9',
          },
        });

        // Spec 1.2.4: Hover 2px --accent ring
        map.addLayer({
          id: 'incidents-hover-ring',
          type: 'circle',
          source: 'incidents-src',
          filter: ['==', ['get', 'isHovered'], true],
          paint: {
            'circle-radius': 9,
            'circle-color': 'transparent',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#0EA5E9',
          },
        });

        // Spec 1.2.3: Core circle radius 5 on top, same arm colour
        map.addLayer({
          id: 'incidents-core',
          type: 'circle',
          source: 'incidents-src',
          paint: {
            'circle-radius': 5,
            'circle-color': armColor,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#FFFFFF',
          },
        });

        // Spec 1.2.5: Rank number as text-field on the top three only
        map.addLayer({
          id: 'incidents-top3-rank',
          type: 'symbol',
          source: 'incidents-src',
          filter: ['all', ['has', 'display_rank'], ['<=', ['coalesce', ['to-number', ['get', 'display_rank']], 999], 3]] as any,
          layout: {
            'text-field': ['to-string', ['coalesce', ['get', 'display_rank'], '']],
            'text-font': ['Noto Sans Regular'],
            'text-size': 10,
            'text-offset': [0, -1.3],
            'text-allow-overlap': true,
          },
          paint: {
            'text-color': '#0F172A',
            'text-halo-color': '#FFFFFF',
            'text-halo-width': 2,
          },
        });

        // Click handler
        map.on('click', 'incidents-core', (e) => {
          if (!e.features || !e.features[0]) return;
          const id = Number(e.features[0].properties?.id);
          if (!isNaN(id)) onIncidentClick(id);
        });

        // Spec 1.2.8: Hover card, 240px, anchored to the cursor
        popupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 14,
          maxWidth: '240px',
          className: 'terralens-hover-card',
        });

        map.on('mousemove', 'incidents-core', (e) => {
          map.getCanvas().style.cursor = 'pointer';
          if (!e.features || !e.features[0]) return;
          const feat = e.features[0];
          const props = feat.properties as any;
          const coords = (feat.geometry as any).coordinates.slice();

          const incId = Number(props.id);
          if (onIncidentHover) onIncidentHover(incId);

          const inc = incidents.find((i) => i.id === incId);
          if (!inc) return;

          // Render hover card: title, severity, rank, and only spatial fields if arm allows
          let spatialHtml = '';
          if (allowSpatial && inc.context) {
            spatialHtml = `
              <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #E2E8F0; display: grid; grid-template-columns: 1fr; gap: 3px; font-size: 11px; color: #475569;">
                <div>Population: <strong style="color: #0F172A;">${(inc.context.population_exposed / 1000).toFixed(0)}k</strong></div>
                <div>Hospitals in range: <strong style="color: ${inc.context.hospital_count > 0 ? '#E11D48' : '#0F172A'};">${inc.context.hospital_count}</strong></div>
                <div>Road access: <strong style="color: #0F172A;">Deficit ${inc.context.accessibility_index.toFixed(2)}</strong></div>
              </div>
            `;
          }

          const cardHtml = `
            <div style="padding: 10px; font-family: Inter, sans-serif; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 6px; box-shadow: 0 4px 12px rgba(15,23,42,0.08); width: 220px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-family: monospace; font-size: 10px; font-weight: bold; color: ${armColor};">RANK #${props.display_rank}</span>
                <span style="font-family: monospace; font-size: 10px; color: #64748B;">SEV ${Number(props.severity_score).toFixed(0)}</span>
              </div>
              <div style="font-size: 12px; font-weight: 600; color: #0F172A; line-height: 1.3;">
                ${props.title?.split(' - ')[0]}
              </div>
              ${spatialHtml}
            </div>
          `;

          popupRef.current?.setLngLat(coords).setHTML(cardHtml).addTo(map);
        });

        map.on('mouseleave', 'incidents-core', () => {
          map.getCanvas().style.cursor = '';
          popupRef.current?.remove();
          if (onIncidentHover) onIncidentHover(null);
        });

        setMapLoaded(true);
      });

      mapRef.current = map;

      return () => {
        try {
          map.remove();
        } catch {}
        mapRef.current = null;
      };
    } catch (err) {
      setWebglError(true);
    }
  }, [variant, allowSpatial, armColor]);

  // Update GeoJSON for incidents
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const src = map.getSource('incidents-src') as maplibregl.GeoJSONSource;
    if (!src) return;

    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: incidents.map((inc) => ({
        type: 'Feature',
        geometry: inc.geometry,
        properties: {
          id: inc.id,
          title: inc.title,
          severity_score: inc.severity_score,
          display_rank: inc.display_rank,
          display_score: inc.display_score,
          impact_radius_m: inc.impact_radius_m,
          isSelected: selectedIds.includes(inc.id),
          isHovered: activeFocusedId === inc.id,
        },
      })),
    };

    src.setData(fc);
  }, [incidents, selectedIds, activeFocusedId, mapLoaded]);

  // Update Dynamic Impact Radius Polygons
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const src = map.getSource('impact-radius-src') as maplibregl.GeoJSONSource;
    if (!src) return;

    const activeIncidents = incidents.filter(
      (inc) =>
        (inc.id === activeFocusedId || selectedIds.includes(inc.id)) &&
        Array.isArray(inc.geometry?.coordinates) &&
        inc.geometry.coordinates.length >= 2
    );

    // Only show impact radius for treatment arm (allowSpatial)
    if (!allowSpatial || activeIncidents.length === 0 || !layerVisibility.impactRadius) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const circles = activeIncidents.map((inc) => {
      const center: [number, number] = [inc.geometry.coordinates[0], inc.geometry.coordinates[1]];
      return createCirclePolygon(center, inc.impact_radius_m);
    });

    src.setData({ type: 'FeatureCollection', features: circles });
  }, [incidents, activeFocusedId, selectedIds, mapLoaded, layerVisibility.impactRadius]);

  // Handle Layer Visibility Toggles
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    const setVisibility = (layerId: string, visible: boolean) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      }
    };

    setVisibility('population-heatmap-fill', layerVisibility.populationHeatmap);
    setVisibility('facilities-core', layerVisibility.hospitals || layerVisibility.fireStations || layerVisibility.schools);
    setVisibility('impact-radius-fill', layerVisibility.impactRadius);
    setVisibility('impact-radius-line', layerVisibility.impactRadius);
    setVisibility('jaipur-boundary-line', layerVisibility.boundary);
  }, [layerVisibility, mapLoaded]);

  if (webglError) {
    return (
      <div className="relative w-full h-full">
        <JaipurMap
          incidents={incidents}
          selectedIds={selectedIds}
          onIncidentClick={onIncidentClick}
          variant={variant}
          activeFocusedId={activeFocusedId}
          onIncidentHover={onIncidentHover}
          layerVisibility={layerVisibility}
        />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-[var(--surface-raised)] border border-[var(--border-hairline)] rounded-[var(--radius-sm)] flex flex-col">
      {/* Spec 1.2.6: Pill segment toggles top-left: Population, Facilities, Roads. Never changes ranking */}
      <div className="absolute top-3 left-3 z-10 flex items-center space-x-1 p-1 bg-[var(--surface)]/95 backdrop-blur-xs border border-[var(--border-hairline)] rounded-[var(--radius-sm)] shadow-xs text-[11px] font-mono">
        {allowSpatial && onToggleLayer && (
          <button
            type="button"
            onClick={() => onToggleLayer('populationHeatmap')}
            className={`px-2 py-1 rounded-[4px] font-medium transition-colors cursor-pointer ${
              layerVisibility.populationHeatmap
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-mid)] hover:bg-[var(--surface-raised)]'
            }`}
          >
            Population
          </button>
        )}
        {allowSpatial && onToggleLayer && (
          <>
            <button
              type="button"
              onClick={() => {
                onToggleLayer('hospitals');
                onToggleLayer('fireStations');
              }}
              className={`px-2 py-1 rounded-[4px] font-medium transition-colors cursor-pointer ${
                layerVisibility.hospitals || layerVisibility.fireStations
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-mid)] hover:bg-[var(--surface-raised)]'
              }`}
            >
              Facilities
            </button>
            <button
              type="button"
              onClick={() => onToggleLayer('roads')}
              className={`px-2 py-1 rounded-[4px] font-medium transition-colors cursor-pointer ${
                layerVisibility.roads
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-mid)] hover:bg-[var(--surface-raised)]'
              }`}
            >
              Roads
            </button>
          </>
        )}
      </div>

      {/* MapLibre Canvas Container */}
      <div ref={mapContainer} className="flex-1 w-full h-full" />

      {/* Spec 1.2.7: Legend row under the map, 12px --text-mid */}
      <div className="shrink-0 px-3 py-2 bg-[var(--surface)] border-t border-[var(--border-hairline)] flex items-center justify-between text-[12px] text-[var(--text-mid)] font-sans">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span
              className="w-3 h-3 rounded-full border border-white shrink-0"
              style={{ backgroundColor: armColor }}
            />
            <span>{isTreatment ? 'Treatment (Cyan)' : 'Control (Slate)'}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-[var(--accent)] shrink-0" />
            <span>Hover ring</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-[var(--accent)] bg-[var(--accent)]/20 shrink-0" />
            <span>Selected (11px ring)</span>
          </div>
          {allowSpatial && (
            <div className="flex items-center space-x-1.5">
              <span
                className="w-3 h-3 rounded-full border border-dashed opacity-50 shrink-0"
                style={{ borderColor: armColor, backgroundColor: armColor }}
              />
              <span>Impact radius</span>
            </div>
          )}
        </div>
        <div className="font-mono text-[11px] text-[var(--text-low)]">
          WGS84 · Jaipur Urban
        </div>
      </div>
    </div>
  );
}
