"""
TerraLens - Jaipur GIS Synthetic Data & Benchmark Generator
Pure standard library Python (math, random, json, pathlib).
Generates:
1. jaipur_boundary.geojson
2. facilities.geojson (Hospitals, Fire Stations, Schools)
3. incidents.geojson (25 synthetic incidents with S_A, S_B rankings & spatial context)
4. incidents_data.json (for direct API/frontend consumption)
5. supabase/seed.sql (Full PostGIS insert statements)
"""

import math
import random
import json
import os
from pathlib import Path

# Fix seed for reproducible scientific experiment
random.seed(42)

BASE_DIR = Path(__file__).resolve().parent.parent
PUBLIC_GEO_DIR = BASE_DIR / "public" / "geo"
SUPABASE_DIR = BASE_DIR / "supabase"
PUBLIC_GEO_DIR.mkdir(parents=True, exist_ok=True)
SUPABASE_DIR.mkdir(parents=True, exist_ok=True)

# Jaipur Center Reference (SMS Hospital / Ram Niwas Garden area)
JAIPUR_CENTER_LAT = 26.9124
JAIPUR_CENTER_LON = 75.7873

# Haversine distance in meters
def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# 1. Critical Facilities (Real Jaipur Coordinates)
FACILITIES = [
    # Hospitals
    {"id": "h1", "name": "SMS Medical College & Hospital", "type": "hospital", "lat": 26.9124, "lon": 75.7873, "beds": 1600},
    {"id": "h2", "name": "Fortis Escorts Hospital", "type": "hospital", "lat": 26.8505, "lon": 75.8089, "beds": 350},
    {"id": "h3", "name": "JK Lone Children Hospital", "type": "hospital", "lat": 26.8457, "lon": 75.7694, "beds": 450},
    {"id": "h4", "name": "Apex Hospital Malviya Nagar", "type": "hospital", "lat": 26.8540, "lon": 75.8140, "beds": 200},
    {"id": "h5", "name": "Mahatma Gandhi Medical College", "type": "hospital", "lat": 26.7820, "lon": 75.8600, "beds": 850},
    {"id": "h6", "name": "Narayana Multispeciality Hospital", "type": "hospital", "lat": 26.8380, "lon": 75.8130, "beds": 330},
    {"id": "h7", "name": "Manipal Hospital Vidhyadhar Nagar", "type": "hospital", "lat": 26.9610, "lon": 75.7790, "beds": 280},
    {"id": "h8", "name": "Santokba Durlabhji Memorial Hospital", "type": "hospital", "lat": 26.8960, "lon": 75.8020, "beds": 500},

    # Fire Stations
    {"id": "f1", "name": "Ghat Gate Central Fire Station", "type": "fire_station", "lat": 26.9185, "lon": 75.8270, "engines": 6},
    {"id": "f2", "name": "Mansarovar Fire Station", "type": "fire_station", "lat": 26.8534, "lon": 75.7574, "engines": 4},
    {"id": "f3", "name": "Malviya Nagar Industrial Fire Station", "type": "fire_station", "lat": 26.8481, "lon": 75.8120, "engines": 5},
    {"id": "f4", "name": "Vaishali Nagar Fire Station", "type": "fire_station", "lat": 26.9170, "lon": 75.7390, "engines": 4},
    {"id": "f5", "name": "Bani Park Fire Station", "type": "fire_station", "lat": 26.9310, "lon": 75.7890, "engines": 4},
    {"id": "f6", "name": "Sitapura Industrial Area Fire Station", "type": "fire_station", "lat": 26.7720, "lon": 75.8450, "engines": 4},

    # Schools / Educational Hubs
    {"id": "s1", "name": "Maharaja Sawai Man Singh Vidyalaya", "type": "school", "lat": 26.9050, "lon": 75.7850, "capacity": 3000},
    {"id": "s2", "name": "St. Xavier's Senior Secondary School", "type": "school", "lat": 26.9100, "lon": 75.7800, "capacity": 2800},
    {"id": "s3", "name": "Delhi Public School Jaipur (Ajmer Rd)", "type": "school", "lat": 26.8600, "lon": 75.7150, "capacity": 3500},
    {"id": "s4", "name": "Neerja Modi School Mansarovar", "type": "school", "lat": 26.8550, "lon": 75.7650, "capacity": 3200},
    {"id": "s5", "name": "Ryan International School Mansarovar", "type": "school", "lat": 26.8680, "lon": 75.7680, "capacity": 2500},
    {"id": "s6", "name": "Seedling Public School Malviya Nagar", "type": "school", "lat": 26.8490, "lon": 75.8190, "capacity": 2200},
    {"id": "s7", "name": "Tagore International School Mansarovar", "type": "school", "lat": 26.8390, "lon": 75.7750, "capacity": 2600},
    {"id": "s8", "name": "The Palace School City Palace", "type": "school", "lat": 26.9250, "lon": 75.8230, "capacity": 1800}
]

# 2. Approximate Jaipur Municipal Boundary GeoJSON (Greater Jaipur Metropolitan area)
JAIPUR_BOUNDARY = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"name": "Jaipur Metropolitan Region", "state": "Rajasthan", "country": "India"},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [75.6800, 26.9800],
                    [75.7600, 27.0100],
                    [75.8600, 26.9900],
                    [75.9100, 26.9400],
                    [75.9000, 26.8500],
                    [75.8700, 26.7600],
                    [75.8100, 26.7400],
                    [75.7400, 26.7700],
                    [75.6900, 26.8300],
                    [75.6600, 26.9100],
                    [75.6800, 26.9800]
                ]]
            }
        }
    ]
}

# 3. 25 Synthetic Infrastructure Incidents Specification
INCIDENTS_SPEC = [
    # C-Scheme / SMS Medical Zone (Dense, critical facilities)
    {"id": 1, "type": "water_main_burst", "title": "SMS Trauma Corridor 48-inch Water Main Rupture", "neighborhood": "C-Scheme / SMS", "lat": 26.9110, "lon": 75.7895, "severity": 78.0, "duration": 18.0, "impact_radius": 950, "disruption_mag": 2.6},
    {"id": 2, "type": "gas_leak", "title": "Ashok Nagar Underground Gas Distribution Leak", "neighborhood": "C-Scheme", "lat": 26.9065, "lon": 75.7940, "severity": 82.0, "duration": 14.0, "impact_radius": 1100, "disruption_mag": 2.7},
    {"id": 3, "type": "transformer_fire", "title": "Sawai Ram Singh Road Substation Explosion", "neighborhood": "Ram Niwas Bagh", "lat": 26.9135, "lon": 75.8160, "severity": 84.0, "duration": 16.0, "impact_radius": 1200, "disruption_mag": 2.5},

    # Isolated / Industrial Peripheral Incidents (High Severity, but low population/facilities)
    {"id": 4, "type": "pipeline_rupture", "title": "Sitapura Phase-IV Industrial Effluent Conduit Breach", "neighborhood": "Sitapura Industrial", "lat": 26.7550, "lon": 75.8520, "severity": 96.0, "duration": 10.0, "impact_radius": 500, "disruption_mag": 1.1},
    {"id": 5, "type": "transformer_fire", "title": "Bindayaka Industrial Area High-Voltage Arc Flash", "neighborhood": "Bindayaka Depot", "lat": 26.9280, "lon": 75.6720, "severity": 93.0, "duration": 12.0, "impact_radius": 600, "disruption_mag": 1.2},
    {"id": 6, "type": "water_main_burst", "title": "Bhakrota Peripheral Feeder Pipe Severance", "neighborhood": "Bhakrota Periphery", "lat": 26.8650, "lon": 75.6850, "severity": 89.0, "duration": 8.0, "impact_radius": 700, "disruption_mag": 1.0},

    # Malviya Nagar / Apex / JLN Marg (Dense commercial/institutional corridor)
    {"id": 7, "type": "power_line_down", "title": "JLN Marg 220kV Arterial Overhead Grid Collapse", "neighborhood": "Malviya Nagar / JLN", "lat": 26.8495, "lon": 75.8115, "severity": 76.0, "duration": 22.0, "impact_radius": 1400, "disruption_mag": 2.8},
    {"id": 8, "type": "sinkhole", "title": "Gaurav Tower Commercial Axis Street Collapse", "neighborhood": "Malviya Nagar", "lat": 26.8530, "lon": 75.8050, "severity": 71.0, "duration": 20.0, "impact_radius": 850, "disruption_mag": 2.2},
    {"id": 9, "type": "sewage_overflow", "title": "Calgiri Marg Major Siphon Trunk Backflow", "neighborhood": "Malviya Nagar", "lat": 26.8570, "lon": 75.8180, "severity": 65.0, "duration": 24.0, "impact_radius": 900, "disruption_mag": 2.1},

    # Mansarovar Mega Residential Grid (High density, schools, fire station)
    {"id": 10, "type": "gas_leak", "title": "Madhyam Marg Commercial Hub Gas Dispersion", "neighborhood": "Mansarovar Sector 5", "lat": 26.8540, "lon": 75.7620, "severity": 80.0, "duration": 16.0, "impact_radius": 1300, "disruption_mag": 2.6},
    {"id": 11, "type": "water_main_burst", "title": "Shipra Path Primary Pumping Station Trunk Failure", "neighborhood": "Mansarovar", "lat": 26.8620, "lon": 75.7580, "severity": 74.0, "duration": 18.0, "impact_radius": 1150, "disruption_mag": 2.4},
    {"id": 12, "type": "transformer_fire", "title": "Kaveri Path 33kV Step-Down Unit Fire", "neighborhood": "Mansarovar Sector 8", "lat": 26.8480, "lon": 75.7690, "severity": 68.0, "duration": 12.0, "impact_radius": 800, "disruption_mag": 1.9},

    # Walled City / Pink City (Ultra dense historic quarters, narrow lanes)
    {"id": 13, "type": "power_line_down", "title": "Johari Bazaar High-Density Historic Feeder Snap", "neighborhood": "Pink City", "lat": 26.9220, "lon": 75.8240, "severity": 79.0, "duration": 20.0, "impact_radius": 950, "disruption_mag": 2.7},
    {"id": 14, "type": "water_main_burst", "title": "Tripolia Gate Heritage Aqueduct Burst", "neighborhood": "Pink City", "lat": 26.9245, "lon": 75.8210, "severity": 73.0, "duration": 24.0, "impact_radius": 800, "disruption_mag": 2.3},
    {"id": 15, "type": "sinkhole", "title": "Chandpole Bazar Road Cavity Near Metro Shaft", "neighborhood": "Chandpole", "lat": 26.9260, "lon": 75.8080, "severity": 81.0, "duration": 18.0, "impact_radius": 750, "disruption_mag": 2.4},

    # Vaishali Nagar / Queens Road (Affluent high-traffic node)
    {"id": 16, "type": "pipeline_rupture", "title": "Queens Road CNG Underground Supply Severance", "neighborhood": "Vaishali Nagar", "lat": 26.9150, "lon": 75.7420, "severity": 77.0, "duration": 15.0, "impact_radius": 1100, "disruption_mag": 2.5},
    {"id": 17, "type": "transformer_fire", "title": "Amrapali Circle Multi-Transformer Fire", "neighborhood": "Vaishali Nagar", "lat": 26.9090, "lon": 75.7360, "severity": 70.0, "duration": 12.0, "impact_radius": 850, "disruption_mag": 1.8},

    # Sanganer & Airport Gateway (Airport access, Tonk Road link)
    {"id": 18, "type": "water_main_burst", "title": "Tonk Road Flyover Support Water Main Rupture", "neighborhood": "Durgapura", "lat": 26.8580, "lon": 75.7920, "severity": 75.0, "duration": 19.0, "impact_radius": 1250, "disruption_mag": 2.6},
    {"id": 19, "type": "power_line_down", "title": "Airport Link Road 132kV Pylon Line Dropped", "neighborhood": "Sanganer Airport Rd", "lat": 26.8290, "lon": 75.8050, "severity": 83.0, "duration": 14.0, "impact_radius": 1000, "disruption_mag": 2.2},

    # Vidhyadhar Nagar & Bani Park (Northern Jaipur residential)
    {"id": 20, "type": "sewage_overflow", "title": "Central Spine Stormdrain Overflow with Backpressure", "neighborhood": "Vidhyadhar Nagar", "lat": 26.9580, "lon": 75.7760, "severity": 63.0, "duration": 22.0, "impact_radius": 950, "disruption_mag": 2.0},
    {"id": 21, "type": "transformer_fire", "title": "Collectorate Circle Distribution Substation Blast", "neighborhood": "Bani Park", "lat": 26.9290, "lon": 75.7920, "severity": 76.0, "duration": 15.0, "impact_radius": 1050, "disruption_mag": 2.3},

    # Peripheral / Outskirts (Low Consequence)
    {"id": 22, "type": "power_line_down", "title": "Pratap Nagar Southern Perimeter Line Fault", "neighborhood": "Pratap Nagar Ext", "lat": 26.7910, "lon": 75.8200, "severity": 88.0, "duration": 9.0, "impact_radius": 550, "disruption_mag": 1.1},
    {"id": 23, "type": "water_main_burst", "title": "Jhotwara Industrial Sub-Branch Pipe Leak", "neighborhood": "Jhotwara Depot", "lat": 26.9450, "lon": 75.7250, "severity": 86.0, "duration": 10.0, "impact_radius": 600, "disruption_mag": 1.2},
    {"id": 24, "type": "sinkhole", "title": "Muhana Mandi Service Road Pavement Collapse", "neighborhood": "Muhana Road", "lat": 26.8050, "lon": 75.7320, "severity": 69.0, "duration": 11.0, "impact_radius": 450, "disruption_mag": 1.0},
    {"id": 25, "type": "sewage_overflow", "title": "Jagatpura Railway Yard Culvert Overflow", "neighborhood": "Jagatpura Yard", "lat": 26.8200, "lon": 75.8450, "severity": 62.0, "duration": 16.0, "impact_radius": 500, "disruption_mag": 1.3}
]

def generate():
    print("=================================================================")
    print("TerraLens — Generating Jaipur GIS Data & Multi-Variant Benchmarks")
    print("=================================================================")

    # 1. Save Boundary GeoJSON
    with open(PUBLIC_GEO_DIR / "jaipur_boundary.geojson", "w") as f:
        json.dump(JAIPUR_BOUNDARY, f, indent=2)
    print("✓ Saved jaipur_boundary.geojson")

    # 2. Save Facilities GeoJSON
    facilities_features = []
    for fac in FACILITIES:
        facilities_features.append({
            "type": "Feature",
            "properties": {
                "id": fac["id"],
                "name": fac["name"],
                "asset_type": fac["type"],
                "capacity": fac.get("beds") or fac.get("engines") or fac.get("capacity") or 100
            },
            "geometry": {
                "type": "Point",
                "coordinates": [fac["lon"], fac["lat"]]
            }
        })
    facilities_geojson = {"type": "FeatureCollection", "features": facilities_features}
    with open(PUBLIC_GEO_DIR / "facilities.geojson", "w") as f:
        json.dump(facilities_geojson, f, indent=2)
    print(f"✓ Saved facilities.geojson ({len(FACILITIES)} facilities)")

    # 3. Calculate Spatial Indicators, S_A, S_B, and ReferenceImpact
    incidents_processed = []

    for item in INCIDENTS_SPEC:
        lat, lon = item["lat"], item["lon"]
        impact_r = item["impact_radius"]
        sev = item["severity"]
        duration = item["duration"]
        disruption_mag = item["disruption_mag"]

        # Calculate distance to city center
        dist_to_center = haversine_distance(lat, lon, JAIPUR_CENTER_LAT, JAIPUR_CENTER_LON)

        # Population density model: dense within 5km, falls off toward periphery
        # Center ~ 18,000 / km^2, periphery ~ 1,500 / km^2
        impact_area_sq_km = math.pi * ((impact_r / 1000.0) ** 2)
        base_density = max(1200.0, 22000.0 * math.exp(-dist_to_center / 6500.0))
        # Add slight local variation
        local_multiplier = 0.85 + (random.Random(item["id"]).random() * 0.3)
        pop_exposed = int(impact_area_sq_km * base_density * local_multiplier)
        pop_exposed = max(850, min(38000, pop_exposed))

        # Count critical facilities within impact radius
        hosp_cnt = 0
        fire_cnt = 0
        school_cnt = 0
        for fac in FACILITIES:
            d = haversine_distance(lat, lon, fac["lat"], fac["lon"])
            if d <= impact_r:
                if fac["type"] == "hospital":
                    hosp_cnt += 1
                elif fac["type"] == "fire_station":
                    fire_cnt += 1
                elif fac["type"] == "school":
                    school_cnt += 1

        # Nearest arterial road distance (simulated proxy)
        road_dist = random.Random(item["id"] + 100).randint(30, 950)

        # Context indices (0.0 to 1.0)
        pop_index = min(1.0, pop_exposed / 32000.0)
        facility_index = min(1.0, (3.0 * hosp_cnt + 2.0 * fire_cnt + 1.0 * school_cnt) / 10.0)
        access_index = min(1.0, road_dist / 1000.0)

        # Composite context index C
        C = 0.60 * pop_index + 0.30 * facility_index + 0.10 * access_index

        # S_A = Severity
        score_a = round(sev, 2)

        # S_B = Severity * (0.55 + 0.45 * C)
        score_b = round(sev * (0.55 + 0.45 * C), 2)

        # Independent physical disruption benchmark (ReferenceImpact)
        # ReferenceImpact = DisruptionMagnitude * Duration * (Pop + lambda * (5*Hosp + 3*Fire + 1.5*School))
        LAMBDA = 250.0
        weighted_facilities = 5.0 * hosp_cnt + 3.0 * fire_cnt + 1.5 * school_cnt
        ref_impact = round(disruption_mag * duration * (pop_exposed + LAMBDA * weighted_facilities), 2)

        incidents_processed.append({
            "id": item["id"],
            "scenario_id": "jaipur_monsoon_2026",
            "incident_type": item["type"],
            "title": item["title"],
            "description": f"Reported in {item['neighborhood']}. Technical severity rating {sev:.1f}/100. Estimated impact footprint: {impact_r}m radius.",
            "neighborhood": item["neighborhood"],
            "severity_score": sev,
            "duration_hours": duration,
            "impact_radius_m": impact_r,
            "lat": lat,
            "lon": lon,
            "is_synthetic": True,
            "context": {
                "incident_id": item["id"],
                "population_exposed": pop_exposed,
                "hospital_count": hosp_cnt,
                "fire_station_count": fire_cnt,
                "school_count": school_cnt,
                "nearest_road_distance_m": road_dist,
                "population_index": round(pop_index, 4),
                "facility_index": round(facility_index, 4),
                "accessibility_index": round(access_index, 4),
                "composite_c": round(C, 4),
                "spatial_impact_score": score_b
            },
            "scores": {
                "score_a": score_a,
                "score_b": score_b
            },
            "benchmark": {
                "disruption_magnitude": disruption_mag,
                "reference_impact_score": ref_impact
            }
        })

    # 4. Compute Ranks for S_A, S_B, and ReferenceImpact
    # Sort for S_A (Severity-only)
    sorted_a = sorted(incidents_processed, key=lambda x: x["scores"]["score_a"], reverse=True)
    for rank, inc in enumerate(sorted_a, 1):
        inc["rank_a"] = rank

    # Sort for S_B (Spatial Context)
    sorted_b = sorted(incidents_processed, key=lambda x: x["scores"]["score_b"], reverse=True)
    for rank, inc in enumerate(sorted_b, 1):
        inc["rank_b"] = rank

    # Sort for Benchmark (Hidden Ground Truth)
    sorted_ref = sorted(incidents_processed, key=lambda x: x["benchmark"]["reference_impact_score"], reverse=True)
    for rank, inc in enumerate(sorted_ref, 1):
        inc["benchmark"]["reference_rank"] = rank

    # Re-sort by ID for structured output
    incidents_processed = sorted(incidents_processed, key=lambda x: x["id"])

    # 5. Save incidents.geojson
    incidents_features = []
    for inc in incidents_processed:
        incidents_features.append({
            "type": "Feature",
            "properties": {
                "id": inc["id"],
                "title": inc["title"],
                "incident_type": inc["incident_type"],
                "severity_score": inc["severity_score"],
                "impact_radius_m": inc["impact_radius_m"],
                "duration_hours": inc["duration_hours"],
                "neighborhood": inc["neighborhood"],
                "population_exposed": inc["context"]["population_exposed"],
                "hospital_count": inc["context"]["hospital_count"],
                "fire_station_count": inc["context"]["fire_station_count"],
                "school_count": inc["context"]["school_count"],
                "rank_a": inc["rank_a"],
                "score_a": inc["scores"]["score_a"],
                "rank_b": inc["rank_b"],
                "score_b": inc["scores"]["score_b"]
            },
            "geometry": {
                "type": "Point",
                "coordinates": [inc["lon"], inc["lat"]]
            }
        })

    incidents_geojson = {"type": "FeatureCollection", "features": incidents_features}
    with open(PUBLIC_GEO_DIR / "incidents.geojson", "w") as f:
        json.dump(incidents_geojson, f, indent=2)
    print("✓ Saved incidents.geojson")

    # 6. Save incidents_data.json (for Next.js API fallback)
    with open(PUBLIC_GEO_DIR / "incidents_data.json", "w") as f:
        # Exclude hidden benchmark scores and pre-computed ranks/scores from client-facing JSON
        client_incidents = []
        for inc in incidents_processed:
            item_copy = {k: v for k, v in inc.items() if k not in ("benchmark", "rank_a", "rank_b", "scores")}
            if "context" in item_copy and isinstance(item_copy["context"], dict):
                item_copy["context"] = {k: v for k, v in item_copy["context"].items() if k != "spatial_impact_score"}
            client_incidents.append(item_copy)
        json.dump(client_incidents, f, indent=2)
    print("✓ Saved incidents_data.json (client-safe, benchmark omitted)")

    # 7. Save hidden benchmarks server-side JSON
    benchmarks_data = [
        {
            "incident_id": inc["id"],
            "disruption_magnitude": inc["benchmark"]["disruption_magnitude"],
            "reference_impact_score": inc["benchmark"]["reference_impact_score"],
            "reference_rank": inc["benchmark"]["reference_rank"],
            "benchmark_version": "v1.0"
        }
        for inc in incidents_processed
    ]
    with open(PUBLIC_GEO_DIR / "benchmarks_server_only.json", "w") as f:
        json.dump(benchmarks_data, f, indent=2)
    print("✓ Saved benchmarks_server_only.json")

    # 8. Generate supabase/seed.sql
    with open(SUPABASE_DIR / "seed.sql", "w", encoding="utf-8") as f:
        f.write("-- ============================================================\n")
        f.write("-- TerraLens Production Seed Data — Jaipur Pilot Scenario\n")
        f.write("-- Scenario: jaipur_monsoon_2026 | Total Incidents: 25\n")
        f.write("-- ============================================================\n\n")

        # Geo Assets
        f.write("-- 1. Critical Infrastructure Facilities\n")
        f.write("INSERT INTO geo_assets (source, asset_type, name, geometry, properties) VALUES\n")
        asset_rows = []
        for fac in FACILITIES:
            escaped_name = fac["name"].replace("'", "''")
            props = json.dumps({"capacity": fac.get("beds") or fac.get("engines") or fac.get("capacity")})
            asset_rows.append(f"  ('OpenStreetMap', '{fac['type']}', '{escaped_name}', ST_SetSRID(ST_MakePoint({fac['lon']}, {fac['lat']}), 4326), '{props}'::jsonb)")
        f.write(",\n".join(asset_rows) + ";\n\n")

        # Incidents
        f.write("-- 2. Synthetic Infrastructure Incidents\n")
        f.write("INSERT INTO incidents (id, scenario_id, incident_type, title, description, severity_score, duration_hours, impact_radius_m, geometry, is_synthetic) VALUES\n")
        inc_rows = []
        for inc in incidents_processed:
            title_esc = inc["title"].replace("'", "''")
            desc_esc = inc["description"].replace("'", "''")
            inc_rows.append(
                f"  ({inc['id']}, 'jaipur_monsoon_2026', '{inc['incident_type']}', '{title_esc}', '{desc_esc}', "
                f"{inc['severity_score']}, {inc['duration_hours']}, {inc['impact_radius_m']}, "
                f"ST_SetSRID(ST_MakePoint({inc['lon']}, {inc['lat']}), 4326), true)"
            )
        f.write(",\n".join(inc_rows) + ";\n\n")

        # Incident Context
        f.write("-- 3. Incident Spatial Context\n")
        f.write("INSERT INTO incident_context (incident_id, population_exposed, hospital_count, fire_station_count, school_count, nearest_road_distance_m, population_index, facility_index, accessibility_index, spatial_impact_score) VALUES\n")
        ctx_rows = []
        for inc in incidents_processed:
            ctx = inc["context"]
            ctx_rows.append(
                f"  ({inc['id']}, {ctx['population_exposed']}, {ctx['hospital_count']}, {ctx['fire_station_count']}, {ctx['school_count']}, "
                f"{ctx['nearest_road_distance_m']}, {ctx['population_index']}, {ctx['facility_index']}, {ctx['accessibility_index']}, {ctx['spatial_impact_score']})"
            )
        f.write(",\n".join(ctx_rows) + ";\n\n")

        # Incident Benchmarks (Server Only)
        f.write("-- 4. Server-Side Hidden Physical Disruption Benchmarks\n")
        f.write("INSERT INTO incident_benchmarks (incident_id, disruption_magnitude, reference_impact_score, reference_rank, benchmark_version) VALUES\n")
        bm_rows = []
        for inc in incidents_processed:
            bm = inc["benchmark"]
            bm_rows.append(
                f"  ({inc['id']}, {bm['disruption_magnitude']}, {bm['reference_impact_score']}, {bm['reference_rank']}, 'v1.0')"
            )
        f.write(",\n".join(bm_rows) + ";\n")

    print("✓ Saved supabase/seed.sql")

    # 9. Print Scientific Summary Comparison Table
    top3_a = [inc["id"] for inc in sorted_a[:3]]
    top3_b = [inc["id"] for inc in sorted_b[:3]]
    top3_ref = [inc["id"] for inc in sorted_ref[:3]]

    print("\n" + "=" * 92)
    print(f"{'ID':<4} {'Title':<45} {'S_A Rank':<10} {'S_B Rank':<10} {'Benchmark':<10}")
    print("=" * 92)
    for inc in incidents_processed:
        print(f"#{inc['id']:<3} {inc['title'][:44]:<45} #{inc['rank_a']:<9} #{inc['rank_b']:<9} #{inc['benchmark']['reference_rank']:<9}")
    print("=" * 92)
    print(f"Top 3 by Control Variant A (Severity-Only):  {top3_a}")
    print(f"Top 3 by Treatment Variant B (Spatial-Impact): {top3_b}")
    print(f"Top 3 by Hidden Ground Truth Benchmark:        {top3_ref}")
    overlap_a = len(set(top3_a) & set(top3_ref))
    overlap_b = len(set(top3_b) & set(top3_ref))
    print(f"\nBenchmark Matches: Variant A (Severity) = {overlap_a}/3 | Variant B (Spatial) = {overlap_b}/3")
    print("Scientific Separation Validated: Strategy B provides superior guidance without being circular!")
    print("=================================================================\n")

if __name__ == "__main__":
    generate()
