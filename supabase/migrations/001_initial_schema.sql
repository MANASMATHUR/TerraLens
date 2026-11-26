-- ============================================================
-- TerraLens Production Database Schema (PostgreSQL + PostGIS)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Base Geospatial Infrastructure Assets
CREATE TABLE IF NOT EXISTS geo_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(64) NOT NULL DEFAULT 'OpenStreetMap',
    asset_type VARCHAR(64) NOT NULL, -- 'hospital', 'fire_station', 'school'
    name VARCHAR(255) NOT NULL,
    geometry GEOMETRY(Point, 4326) NOT NULL,
    properties JSONB DEFAULT '{}'::jsonb,
    source_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Infrastructure Incidents
CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    scenario_id VARCHAR(64) NOT NULL DEFAULT 'jaipur_monsoon_2026',
    incident_type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity_score NUMERIC(5,2) NOT NULL,
    duration_hours NUMERIC(5,2) NOT NULL,
    impact_radius_m INTEGER NOT NULL,
    geometry GEOMETRY(Point, 4326) NOT NULL,
    is_synthetic BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Incident Spatial Context
CREATE TABLE IF NOT EXISTS incident_context (
    incident_id INTEGER PRIMARY KEY REFERENCES incidents(id) ON DELETE CASCADE,
    population_exposed INTEGER NOT NULL,
    hospital_count INTEGER NOT NULL DEFAULT 0,
    fire_station_count INTEGER NOT NULL DEFAULT 0,
    school_count INTEGER NOT NULL DEFAULT 0,
    nearest_road_distance_m NUMERIC(8,2) NOT NULL,
    population_index NUMERIC(5,4) NOT NULL,
    facility_index NUMERIC(5,4) NOT NULL,
    accessibility_index NUMERIC(5,4) NOT NULL,
    spatial_impact_score NUMERIC(5,2) NOT NULL
);

-- 4. SERVER-ONLY Hidden Benchmark
CREATE TABLE IF NOT EXISTS incident_benchmarks (
    incident_id INTEGER PRIMARY KEY REFERENCES incidents(id) ON DELETE CASCADE,
    disruption_magnitude NUMERIC(4,2) NOT NULL,
    reference_impact_score NUMERIC(12,2) NOT NULL,
    reference_rank INTEGER NOT NULL,
    benchmark_version VARCHAR(32) NOT NULL DEFAULT 'v1.0'
);

-- 5. Experiment Sessions
CREATE TABLE IF NOT EXISTS experiment_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL,
    scenario_id VARCHAR(64) NOT NULL,
    variant VARCHAR(32) NOT NULL, -- 'severity_only' or 'spatial_impact'
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds NUMERIC(6,2),
    successful BOOLEAN,
    selected_incident_ids INTEGER[],
    precision_at_3 NUMERIC(5,4),
    ndcg_at_3 NUMERIC(5,4),
    flagsmith_event_status VARCHAR(32) DEFAULT 'pending',
    CONSTRAINT unique_participant_scenario UNIQUE (participant_id, scenario_id)
);

-- Spatial & Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_geo_assets_geom ON geo_assets USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_incidents_geom ON incidents USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_sessions_participant ON experiment_sessions(participant_id);

-- Row Level Security (RLS) Policies
ALTER TABLE incident_benchmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "benchmarks_service_only" ON incident_benchmarks;
CREATE POLICY "benchmarks_service_only" ON incident_benchmarks FOR ALL USING (false);

ALTER TABLE experiment_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sessions_service_only" ON experiment_sessions;
CREATE POLICY "sessions_service_only" ON experiment_sessions FOR ALL USING (false);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "incidents_read_all" ON incidents;
CREATE POLICY "incidents_read_all" ON incidents FOR SELECT USING (true);

ALTER TABLE incident_context ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "context_read_all" ON incident_context;
CREATE POLICY "context_read_all" ON incident_context FOR SELECT USING (true);

ALTER TABLE geo_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assets_read_all" ON geo_assets;
CREATE POLICY "assets_read_all" ON geo_assets FOR SELECT USING (true);
