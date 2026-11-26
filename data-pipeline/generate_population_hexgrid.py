"""
Generate a synthetic radial-decay hexagonal population surface and distance rings.
This is a visualization layer only; it is not WorldPop or census data.
- Center: Jaipur (26.9124, 75.7873)
- Warm golden/amber hexagonal gradient fading to outer edges
- Concentric distance rings (SMS Hospital core, Ring 1, Ring 2)
"""

import math
import random
import json
from pathlib import Path

random.seed(42)

PUBLIC_GEO_DIR = Path(__file__).resolve().parent.parent / "public" / "geo"
PUBLIC_GEO_DIR.mkdir(parents=True, exist_ok=True)

CENTER_LAT = 26.9124
CENTER_LON = 75.7873

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1-a))

def create_hexagon(center_lon, center_lat, radius_deg):
    angles = [math.radians(60 * i + 30) for i in range(6)]
    coords = []
    for a in angles:
        lon = center_lon + radius_deg * math.cos(a) * 1.15
        lat = center_lat + radius_deg * math.sin(a)
        coords.append([round(lon, 5), round(lat, 5)])
    coords.append(coords[0])
    return coords

def create_circle_ring(center_lon, center_lat, radius_km, num_points=64):
    coords = []
    r_deg_lat = radius_km / 111.0
    r_deg_lon = radius_km / (111.0 * math.cos(math.radians(center_lat)))
    for i in range(num_points):
        theta = (2 * math.pi * i) / num_points
        lon = center_lon + r_deg_lon * math.cos(theta)
        lat = center_lat + r_deg_lat * math.sin(theta)
        coords.append([round(lon, 5), round(lat, 5)])
    coords.append(coords[0])
    return coords

def generate_hex_grid():
    features = []
    # Grid coverage
    hex_radius = 0.0020 # ~220m, denser tiling to reduce the visible cell pattern
    lat_step = hex_radius * 1.5
    lon_step = hex_radius * math.sqrt(3)

    min_lat, max_lat = 26.78, 27.02
    min_lon, max_lon = 75.66, 75.92

    row = 0
    curr_lat = min_lat
    idx = 0
    while curr_lat <= max_lat:
        offset = (lon_step / 2.0) if (row % 2 == 1) else 0.0
        curr_lon = min_lon + offset
        while curr_lon <= max_lon:
            d = haversine(CENTER_LAT, CENTER_LON, curr_lat, curr_lon)
            # Only inside 12 km radius
            if d <= 12.5:
                # Synthetic density falls off from the city center.
                density = math.exp(-d / 4.2)
                # Random slight noise
                density *= (0.85 + 0.3 * random.random())
                density = max(0.04, min(1.0, density))

                # Color step
                if density > 0.65:
                    color = "#f59e0b" # amber dark
                    tier = "very_high"
                elif density > 0.40:
                    color = "#fbbf24" # amber medium
                    tier = "high"
                elif density > 0.20:
                    color = "#fde68a" # yellow light
                    tier = "moderate"
                else:
                    color = "#fef3c7" # pale yellow
                    tier = "low"

                poly = create_hexagon(curr_lon, curr_lat, hex_radius * 0.95)
                features.append({
                    "type": "Feature",
                    "id": idx,
                    "properties": {
                        "density": round(density, 3),
                        "tier": tier,
                        "color": color,
                        "opacity": round(0.25 + 0.45 * density, 2)
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [poly]
                    }
                })
                idx += 1
            curr_lon += lon_step
        curr_lat += lat_step
        row += 1

    geojson = {"type": "FeatureCollection", "features": features}
    out_file = PUBLIC_GEO_DIR / "jaipur_population_hexgrid.geojson"
    with open(out_file, "w") as f:
        json.dump(geojson, f)
    print(f"Generated {len(features)} synthetic radial-decay cells -> {out_file}")

def generate_distance_rings():
    # Ring 1: 3.2km (Inner Core / SMS Medical Axis)
    # Ring 2: 7.0km (Urban Corridor)
    # Sub-ring: Sitapura / Sanganer pocket
    ring1 = create_circle_ring(CENTER_LON, CENTER_LAT, 3.5)
    ring2 = create_circle_ring(CENTER_LON, CENTER_LAT, 6.8)
    sub_ring = create_circle_ring(75.83, 26.88, 1.8)

    features = [
        {
            "type": "Feature",
            "properties": {"name": "Inner Core (SMS Medical Enclave)", "radius_km": 3.5, "level": 1},
            "geometry": {"type": "Polygon", "coordinates": [ring1]}
        },
        {
            "type": "Feature",
            "properties": {"name": "Greater Urban Ring", "radius_km": 6.8, "level": 2},
            "geometry": {"type": "Polygon", "coordinates": [ring2]}
        },
        {
            "type": "Feature",
            "properties": {"name": "Eastern Corridor Buffer", "radius_km": 1.8, "level": 3},
            "geometry": {"type": "Polygon", "coordinates": [sub_ring]}
        }
    ]

    geojson = {"type": "FeatureCollection", "features": features}
    out_file = PUBLIC_GEO_DIR / "jaipur_distance_rings.geojson"
    with open(out_file, "w") as f:
        json.dump(geojson, f)
    print(f"✓ Generated distance rings -> {out_file}")

if __name__ == "__main__":
    generate_hex_grid()
    generate_distance_rings()
