"""
TerraLens - 3D Jaipur Building Generator
Generates ~1,400 realistic 3D building polygon footprints across Jaipur's key zones:
1. Walled City / Pink City: Dense, low-rise (1-3 storeys, 4-10m)
2. C-Scheme & MI Road: Mid-rise commercial & institutional (4-7 storeys, 14-24m)
3. Tonk Road & JLN Marg: High-rise commercial, IT parks & hospitals (6-12 storeys, 20-40m)
4. Mansarovar & Malviya Nagar: Mixed residential & retail (3-6 storeys, 10-20m)

Uses ONLY standard library Python (math, random, json).
"""

import math
import random
import json
from pathlib import Path

random.seed(42)

PUBLIC_GEO_DIR = Path(__file__).resolve().parent.parent / "public" / "geo"
PUBLIC_GEO_DIR.mkdir(parents=True, exist_ok=True)

# Key Jaipur neighborhood hubs (center_lat, center_lon, radius_km, base_height_m, height_variance_m, density)
ZONES = [
    {"name": "C-Scheme / Secretariat", "lat": 26.9080, "lon": 75.7980, "radius": 1.2, "min_h": 14.0, "max_h": 32.0, "count": 280},
    {"name": "SMS Medical Hub", "lat": 26.9124, "lon": 75.7873, "radius": 0.8, "min_h": 18.0, "max_h": 42.0, "count": 180},
    {"name": "Pink City / Walled City", "lat": 26.9240, "lon": 75.8230, "radius": 1.5, "min_h": 6.0, "max_h": 12.0, "count": 320},
    {"name": "Tonk Road / JLN Commercial", "lat": 26.8520, "lon": 75.8080, "radius": 1.4, "min_h": 16.0, "max_h": 40.0, "count": 260},
    {"name": "Mansarovar Commercial", "lat": 26.8550, "lon": 75.7620, "radius": 1.2, "min_h": 10.0, "max_h": 22.0, "count": 220},
    {"name": "Vaishali Nagar Corridor", "lat": 26.9120, "lon": 75.7410, "radius": 1.0, "min_h": 10.0, "max_h": 24.0, "count": 160},
]

def generate_building_polygon(center_lat, center_lon, size_m=35.0):
    # Convert meters to approx lat/lon degrees (Jaipur is ~26.9N)
    # 1 deg lat ~ 111,000m, 1 deg lon ~ 99,000m
    d_lat = (size_m / 111000.0) / 2.0
    d_lon = (size_m / 99000.0) / 2.0

    # Slight rectangular jitter
    jitter_lat = (random.random() * 0.4 + 0.8) * d_lat
    jitter_lon = (random.random() * 0.4 + 0.8) * d_lon

    # 4 corners of rectangle
    coords = [
        [round(center_lon - jitter_lon, 6), round(center_lat - jitter_lat, 6)],
        [round(center_lon + jitter_lon, 6), round(center_lat - jitter_lat, 6)],
        [round(center_lon + jitter_lon, 6), round(center_lat + jitter_lat, 6)],
        [round(center_lon - jitter_lon, 6), round(center_lat + jitter_lat, 6)],
        [round(center_lon - jitter_lon, 6), round(center_lat - jitter_lat, 6)], # close ring
    ]
    return coords

def main():
    features = []
    b_id = 1

    for zone in ZONES:
        lat_c, lon_c = zone["lat"], zone["lon"]
        r_km = zone["radius"]

        for _ in range(zone["count"]):
            # Scatter within circle
            angle = random.random() * 2 * math.pi
            # Square root distribution for uniform radial scatter
            dist = math.sqrt(random.random()) * r_km

            # Offset in degrees
            offset_lat = (dist * 1000.0 * math.sin(angle)) / 111000.0
            offset_lon = (dist * 1000.0 * math.cos(angle)) / 99000.0

            b_lat = lat_c + offset_lat
            b_lon = lon_c + offset_lon

            # Random building size (18m to 48m footprint)
            size = random.uniform(18.0, 48.0)
            height = round(random.uniform(zone["min_h"], zone["max_h"]), 1)
            levels = max(1, int(round(height / 3.2)))

            poly = generate_building_polygon(b_lat, b_lon, size)

            features.append({
                "type": "Feature",
                "id": b_id,
                "properties": {
                    "id": b_id,
                    "height": height,
                    "levels": levels,
                    "zone": zone["name"],
                    "min_height": 0
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [poly]
                }
            })
            b_id += 1

    output_geojson = {
        "type": "FeatureCollection",
        "features": features
    }

    out_file = PUBLIC_GEO_DIR / "jaipur_buildings_3d.geojson"
    with open(out_file, "w") as f:
        json.dump(output_geojson, f)

    print(f"✓ Generated {len(features)} 3D building footprints -> {out_file}")

if __name__ == "__main__":
    main()
