'use client';

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { IncidentWithContext, ExperimentVariant } from '@/types';
import { createCirclePolygon } from '@/lib/gis/geometry';
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
}

const DEFAULT_LAYERS: LayerVisibility = {
  populationHeatmap: true,
  hospitals: true,
  fireStations: true,
  schools: true,
  roads: true,
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
  populationOpacity = 62,
}: JaipurMapLibreProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [webglError, setWebglError] = useState(false);
  const [legendCollapsed, setLegendCollapsed] = useState(false);

  // Initialize MapLibre GL map with OpenFreeMap Dark vector style
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Check WebGL availability before attempting MapLibre initialization
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        console.warn('[JaipurMapLibre] WebGL is not available on this browser/environment. Falling back to Leaflet 2D GIS.');
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
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: JAIPUR_CENTER,
      zoom: 12.2,
      minZoom: 10,
      maxZoom: 18,
      maxBounds: JAIPUR_BOUNDS,
      attributionControl: false, // Customized below
    });

    // Add Navigation & Scale Controls
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
        customAttribution: '© OpenFreeMap © OpenStreetMap contributors',
      }),
      'bottom-right'
    );

    map.on('styleimagemissing', (e) => {
      // Provide a transparent fallback image for any missing style sprite icons (e.g. OpenFreeMap wood-pattern)
      const id = e.id;
      if (!map.hasImage(id)) {
        const emptyImage = {
          width: 1,
          height: 1,
          data: new Uint8Array([0, 0, 0, 0]),
        };
        map.addImage(id, emptyImage);
      }
    });

    map.on('load', async () => {
      // 1. Add Jaipur Municipal Boundary Source & Layer
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
              'line-color': '#06B6D4',
              'line-width': 1.5,
              'line-dasharray': [4, 3],
              'line-opacity': 0.65,
            },
          });
        }
      } catch (err) {
        console.warn('Boundary layer load warning:', err);
      }

      // Synthetic population surface: adjacent cells create a continuous field without circular buffers.
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
                ['get', 'density'],
                0.0, 'rgba(15, 23, 42, 0.00)',
                0.08, 'rgba(31, 105, 125, 0.10)',
                0.22, 'rgba(36, 143, 151, 0.18)',
                0.45, 'rgba(146, 174, 117, 0.27)',
                0.75, 'rgba(224, 194, 112, 0.36)',
              ],
            'fill-opacity': 0.62,
            },
          });
        }
      } catch (err) {
        console.warn('Population hexgrid load warning:', err);
      }

      // Independently switchable facility types; source data records need field verification.
      try {
        const facRes = await fetch('/geo/facilities.geojson');
        if (facRes.ok) {
          const facData = await facRes.json();
          map.addSource('facilities-src', {
            type: 'geojson',
            data: facData,
          });

          // Facility Outer Ring
          map.addLayer({
            id: 'facilities-halo',
            type: 'circle',
            source: 'facilities-src',
            filter: ['in', ['get', 'asset_type'], ['literal', ['hospital', 'fire_station', 'school']]],
            paint: {
              'circle-radius': 6.5,
              'circle-color': '#0F172A',
              'circle-stroke-width': 1.5,
              'circle-stroke-color': [
                'match',
                ['get', 'asset_type'],
                'hospital', '#EC4899', // Magenta
                'fire_station', '#F97316', // Orange
                'school', '#EAB308', // Amber
                '#94A3B8',
              ],
              'circle-opacity': 0.9,
            },
          });

          // Facility Core Dot
          map.addLayer({
            id: 'facilities-core',
            type: 'circle',
            source: 'facilities-src',
            filter: ['in', ['get', 'asset_type'], ['literal', ['hospital', 'fire_station', 'school']]],
            paint: {
              'circle-radius': 3.5,
              'circle-color': [
                'match',
                ['get', 'asset_type'],
                'hospital', '#EC4899',
                'fire_station', '#F97316',
                'school', '#EAB308',
                '#94A3B8',
              ],
            },
          });

          // Facility Click Popup
          map.on('click', 'facilities-halo', (e) => {
            if (!e.features || !e.features[0]) return;
            const feat = e.features[0];
            const props = feat.properties as any;
            const coords = (feat.geometry as any).coordinates.slice();

            new maplibregl.Popup({ offset: 12, className: 'terralens-popup' })
              .setLngLat(coords)
              .setHTML(`
                <div style="font-family: sans-serif; font-size: 11px; color: #0F172A; padding: 2px;">
                  <div style="font-size: 9px; text-transform: uppercase; font-family: monospace; font-weight: bold; color: ${
                    props.asset_type === 'hospital' ? '#DB2777' : props.asset_type === 'fire_station' ? '#EA580C' : '#CA8A04'
                  };">
                    ${props.asset_type.replace('_', ' ')}
                  </div>
                  <div style="font-weight: bold; font-size: 12px; margin-top: 2px;">${props.name}</div>
                  ${props.capacity ? `<div style="font-size: 10px; color: #64748B; margin-top: 2px;">Bed Capacity: ${props.capacity}</div>` : ''}
                </div>
              `)
              .addTo(map);
          });

          map.on('mouseenter', 'facilities-halo', () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', 'facilities-halo', () => {
            map.getCanvas().style.cursor = '';
          });
        }
      } catch (err) {
        console.warn('Facilities load warning:', err);
      }

      // Toggle the OSM road and street line layers supplied by OpenFreeMap style.
      const roadLayers = map.getStyle().layers.filter((layer) => /road|street|transportation/i.test(layer.id) && layer.type === 'line').map((layer) => layer.id);
      // save ids for the visibility effect below
      (map as maplibregl.Map & { __terraRoadLayers?: string[] }).__terraRoadLayers = roadLayers;

      // Dynamic impact radius source and layers
      map.addSource('impact-radius-src', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Impact Radius Translucent Buffer Fill
      map.addLayer({
        id: 'impact-radius-fill',
        type: 'fill',
        source: 'impact-radius-src',
        paint: {
          'fill-color': 'rgba(168, 85, 247, 0.22)',
          'fill-opacity': 0.85,
        },
      });

      // Impact Radius Outer Perimeter Line
      map.addLayer({
        id: 'impact-radius-line',
        type: 'line',
        source: 'impact-radius-src',
        paint: {
          'line-color': '#C084FC',
          'line-width': 2,
          'line-dasharray': [3, 2],
          'line-opacity': 0.95,
        },
      });

      // 6. Add Incidents Source (with optional Clustering)
      map.addSource('incidents-src', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 11,
        clusterRadius: 38,
      });

      // Cluster Circle Layer
      map.addLayer({
        id: 'incidents-clusters',
        type: 'circle',
        source: 'incidents-src',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#F59E0B', // Amber for < 5
            5, '#F97316', // Orange for 5-9
            10, '#EF4444', // Red for 10+
          ],
          'circle-radius': ['step', ['get', 'point_count'], 14, 5, 18, 10, 24],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
          'circle-opacity': 0.9,
        },
      });

      // Cluster Count Text Label
      map.addLayer({
        id: 'incidents-cluster-count',
        type: 'symbol',
        source: 'incidents-src',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
        },
        paint: {
          'text-color': '#FFFFFF',
        },
      });

      // Selected Halo Ring
      map.addLayer({
        id: 'incidents-selected-ring',
        type: 'circle',
        source: 'incidents-src',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 14,
          'circle-color': 'transparent',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#38BDF8',
          'circle-stroke-opacity': [
            'case',
            ['get', 'isSelected'],
            1.0,
            0.0,
          ],
        },
      });

      // Active / Hovered Ring
      map.addLayer({
        id: 'incidents-hover-ring',
        type: 'circle',
        source: 'incidents-src',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 11,
          'circle-color': 'transparent',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#F8FAFC',
          'circle-stroke-opacity': [
            'case',
            ['get', 'isHovered'],
            0.9,
            0.0,
          ],
        },
      });

      // Unclustered Incident Marker Points
      map.addLayer({
        id: 'incidents-points',
        type: 'circle',
        source: 'incidents-src',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': [
            'case',
            ['get', 'isSelected'],
            8.5,
            ['get', 'isHovered'],
            8.0,
            6.5,
          ],
          'circle-color': [
            'step',
            ['get', 'severity_score'],
            '#38BDF8', // < 75: Sky Blue
            75, '#F59E0B', // 75-84: Amber
            85, '#EF4444', // >= 85: Crimson Red
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#0F172A',
        },
      });

      map.addLayer({
        id: 'incident-labels', type: 'symbol', source: 'incidents-src',
        filter: ['!', ['has', 'point_count']], minzoom: 13,
        layout: { 'text-field': ['concat', '#', ['to-string', ['get', 'id']]], 'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 16, 13], 'text-offset': [0, 1.4], 'text-allow-overlap': false },
        paint: { 'text-color': '#e2e8f0', 'text-halo-color': '#0f172a', 'text-halo-width': 1.5 },
      });

      // Incident Click Handler
      map.on('click', 'incidents-points', (e) => {
        if (!e.features || !e.features[0]) return;
        const incId = Number(e.features[0].properties?.id);
        if (!isNaN(incId)) {
          onIncidentClick(incId);
        }
      });

      // Cluster Click -> Zoom In
      map.on('click', 'incidents-clusters', async (e) => {
        if (!e.features || !e.features[0]) return;
        const features = map.queryRenderedFeatures(e.point, { layers: ['incidents-clusters'] });
        const clusterId = features[0].properties.cluster_id;
        const source = map.getSource('incidents-src') as maplibregl.GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        const coords = (features[0].geometry as any).coordinates;
        map.easeTo({ center: coords, zoom: Math.min(zoom + 0.5, 16) });
      });

      // Cursor & Hover Handlers
      map.on('mouseenter', 'incidents-points', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        if (e.features && e.features[0] && onIncidentHover) {
          const incId = Number(e.features[0].properties?.id);
          onIncidentHover(incId);
        }
      });

      map.on('mouseleave', 'incidents-points', () => {
        map.getCanvas().style.cursor = '';
        if (onIncidentHover) {
          onIncidentHover(null);
        }
      });

      map.on('mouseenter', 'incidents-clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'incidents-clusters', () => {
        map.getCanvas().style.cursor = '';
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
    } catch (initErr) {
      console.warn('[JaipurMapLibre] WebGL MapLibre initialization failed:', initErr);
      setWebglError(true);
    }
  }, []);

  // Update Incident GeoJSON Data when incidents, selection or hover changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const source = map.getSource('incidents-src') as maplibregl.GeoJSONSource;
    if (!source) return;

    const geojsonData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: incidents.map((inc) => {
        const isSelected = selectedIds.includes(inc.id);
        const isHovered = activeFocusedId === inc.id;
        return {
          type: 'Feature',
          geometry: inc.geometry,
          properties: {
            id: inc.id,
            title: inc.title,
            incident_type: inc.incident_type,
            severity_score: inc.severity_score,
            display_score: inc.display_score,
            display_rank: inc.display_rank,
            impact_radius_m: inc.impact_radius_m,
            isSelected,
            isHovered,
          },
        };
      }),
    };

    source.setData(geojsonData);
  }, [incidents, selectedIds, activeFocusedId, mapLoaded]);

  // Update Dynamic Impact Radius Polygons (Translucent Buffer Discs)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const source = map.getSource('impact-radius-src') as maplibregl.GeoJSONSource;
    if (!source) return;

    const activeIncidents = incidents.filter(
      (inc) => (inc.id === activeFocusedId || selectedIds.includes(inc.id)) &&
        Array.isArray(inc.geometry?.coordinates) && inc.geometry.coordinates.length >= 2 &&
        inc.geometry.coordinates.slice(0, 2).every(Number.isFinite)
    );

    if (activeIncidents.length === 0 || !layerVisibility.impactRadius) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const bufferFeatures = activeIncidents.map((inc) => {
      const center: [number, number] = [inc.geometry.coordinates[0], inc.geometry.coordinates[1]];
      return createCirclePolygon(center, inc.impact_radius_m);
    });

    source.setData({
      type: 'FeatureCollection',
      features: bufferFeatures,
    });
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
    if (map.getLayer('population-heatmap-fill')) map.setPaintProperty('population-heatmap-fill', 'fill-opacity', Math.max(0, Math.min(100, populationOpacity)) / 100);
    const facilityFilter = ['in', ['get', 'asset_type'], ['literal', [
      ...(layerVisibility.hospitals ? ['hospital'] : []),
      ...(layerVisibility.fireStations ? ['fire_station'] : []),
      ...(layerVisibility.schools ? ['school'] : []),
    ]]] as maplibregl.FilterSpecification;
    if (map.getLayer('facilities-halo')) map.setFilter('facilities-halo', facilityFilter);
    if (map.getLayer('facilities-core')) map.setFilter('facilities-core', facilityFilter);
    const roadLayers = (map as maplibregl.Map & { __terraRoadLayers?: string[] }).__terraRoadLayers ?? [];
    roadLayers.forEach((id) => setVisibility(id, layerVisibility.roads));
    setVisibility('impact-radius-fill', layerVisibility.impactRadius);
    setVisibility('impact-radius-line', layerVisibility.impactRadius);
    setVisibility('jaipur-boundary-line', layerVisibility.boundary);
  }, [layerVisibility, populationOpacity, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapContainer.current) return;
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(mapContainer.current);
    return () => observer.disconnect();
  }, []);

  // Camera pan to focused incident when hovered or selected
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !activeFocusedId) return;
    const inc = incidents.find((i) => i.id === activeFocusedId);
    if (inc && inc.geometry?.coordinates) {
      mapRef.current.easeTo({
        center: [inc.geometry.coordinates[0], inc.geometry.coordinates[1]],
        duration: 400,
      });
    }
  }, [activeFocusedId, incidents, mapLoaded]);

  if (webglError) {
    return (
      <div className="relative w-full h-full">
        <div className="absolute top-2 left-2 z-20 bg-slate-900/90 text-sky-200 text-[10px] font-mono px-2.5 py-1 rounded shadow-md border border-sky-600/50 flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Active 2D Cartographic Engine (High-Performance Leaflet GIS)</span>
        </div>
        <JaipurMap
          incidents={incidents}
          selectedIds={selectedIds}
          variant={variant}
          activeFocusedId={activeFocusedId}
          onIncidentClick={onIncidentClick}
          onIncidentHover={onIncidentHover}
        />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0F172A]">
      {/* MapLibre WebGL Canvas Container */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Professional Cartographic Legend (Matching Hackathon GIS Standards) */}
      <div className={`absolute top-14 left-3 z-10 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg shadow-lg text-[10px] font-sans text-slate-200 select-none transition-all duration-200 ${legendCollapsed ? 'p-1.5 max-w-[160px]' : 'p-2 space-y-1.5 max-w-[190px]'}`}>
        {/* Header / Collapse Toggle */}
        <button
          type="button"
          onClick={() => setLegendCollapsed(!legendCollapsed)}
          className="w-full flex items-center justify-between text-left pb-1 border-b border-slate-800 text-[10px] font-mono uppercase font-bold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer group"
          title={legendCollapsed ? "Expand legend" : "Collapse legend"}
        >
          <div className="flex items-center space-x-1 truncate">
            <span className="truncate">JAIPUR GIS LAYERS</span>
            <span className="text-[9px] text-slate-500 group-hover:text-slate-300">
              {legendCollapsed ? '▼' : '▲'}
            </span>
          </div>
          <span className="text-sky-400 text-[9px] ml-1 shrink-0">WGS84</span>
        </button>

        {!legendCollapsed && (
          <>
            {/* Synthetic population gradient; not WorldPop or census data. */}
            {layerVisibility.populationHeatmap && (
              <div className="space-y-1">
                <div className="text-[10px] text-slate-300 font-semibold flex justify-between">
                  <span>Synthetic population surface</span>
                  <span className="font-mono text-[9px] text-slate-400">Radial model</span>
                </div>
                <div className="h-2 w-full rounded-sm bg-gradient-to-r from-slate-900 via-teal-600 to-amber-300 border border-slate-700/60" />
                <div className="flex justify-between text-[8px] font-mono text-slate-400">
                  <span>Low</span>
                  <span>Moderate</span>
                  <span>Extreme</span>
                </div>
              </div>
            )}

            {/* Incident Severity Dots (Image 3 Style) */}
            <div className="space-y-1 pt-1 border-t border-slate-800/80">
              <div className="text-[10px] text-slate-300 font-semibold">Incident SCADA Severity</div>
              <div className="grid grid-cols-3 gap-1 text-[9px] font-mono">
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 shadow-xs" />
                  <span>&ge;85 High</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shadow-xs" />
                  <span>75-84 Med</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-sky-400 shadow-xs" />
                  <span>&lt;75 Mod</span>
                </div>
              </div>
            </div>

            {/* Critical Infrastructure Markers (Image 2 Style) */}
            {(layerVisibility.hospitals || layerVisibility.fireStations || layerVisibility.schools) && (
              <div className="space-y-1 pt-1 border-t border-slate-800/80">
                <div className="text-[10px] text-slate-300 font-semibold">Reference facilities · unverified coordinates</div>
                <div className="flex items-center space-x-3 text-[9px]">
                  <div className="flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-pink-500" />
                    <span>Hospital</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    <span>Fire</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-yellow-400" />
                    <span>School</span>
                  </div>
                </div>
              </div>
            )}

            {/* Impact Radius Buffer (Image 4 Style) */}
            {layerVisibility.impactRadius && (
              <div className="flex items-center space-x-1.5 pt-1 border-t border-slate-800/80 text-[9px] text-purple-300 font-mono">
                <span className="w-2.5 h-2.5 rounded-full border border-purple-400 bg-purple-500/30" />
                <span>Impact Disruption Radius</span>
              </div>
            )}
          </>
        )}
      </div>
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded bg-slate-950/85 border border-slate-700 px-3 py-1 text-[10px] font-mono text-slate-300 pointer-events-none">JAIPUR · approximate boundary · WGS84</div>
      <div className="absolute bottom-8 right-2 z-10 text-[9px] text-slate-400 bg-slate-950/75 rounded px-2 py-1 pointer-events-none">Population: synthetic radial model · Incidents: synthetic scenario · Roads: OpenStreetMap</div>
    </div>
  );
}
