/**
 * Generates a GeoJSON Polygon feature representing a circular buffer in EPSG:4326.
 * Used for dynamic MapLibre incident impact-radius visualization.
 */
export function createCirclePolygon(
  center: [number, number],
  radiusMeters: number,
  points: number = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
  const [lng, lat] = center;
  const latRad = lat * (Math.PI / 180);
  const deltaLat = radiusMeters / 111320;
  const deltaLng = radiusMeters / (111320 * Math.cos(latRad));
  const coordinates: [number, number][] = [];

  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const pLng = Number((lng + deltaLng * Math.cos(theta)).toFixed(6));
    const pLat = Number((lat + deltaLat * Math.sin(theta)).toFixed(6));
    coordinates.push([pLng, pLat]);
  }

  return {
    type: 'Feature',
    properties: {
      radius_m: radiusMeters,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
  };
}
