// ============================================================
// TerraLens — Core Type Definitions
// ============================================================

// ---- Geospatial Assets ----
export interface GeoAsset {
  id: string;
  source: string;
  asset_type: 'hospital' | 'fire_station' | 'school' | 'substation' | 'boundary';
  name: string;
  geometry: GeoJSON.Point;
  properties: Record<string, unknown>;
}

// ---- Infrastructure Incidents ----
export interface Incident {
  id: number;
  scenario_id: string;
  incident_type: IncidentType;
  title: string;
  description: string;
  severity_score: number;
  duration_hours: number;
  impact_radius_m: number;
  neighborhood?: string;
  geometry: GeoJSON.Point;
  is_synthetic: boolean;
}

export type IncidentType =
  | 'water_main_burst'
  | 'transformer_fire'
  | 'gas_leak'
  | 'sinkhole'
  | 'sewage_overflow'
  | 'power_line_down'
  | 'pipeline_rupture';

// ---- Spatial Context Indicators ----
export interface IncidentContext {
  incident_id: number;
  population_exposed: number;
  hospital_count: number;
  fire_station_count: number;
  school_count: number;
  nearest_road_distance_m: number;
  population_index: number;    // 0–1
  facility_index: number;      // 0–1
  accessibility_index: number; // 0–1
  spatial_impact_score: number; // S_B
}

// ---- Combined incident with context (for frontend) ----
export interface IncidentWithContext extends Incident {
  context: IncidentContext;
  display_score: number;  // S_A or S_B depending on variant
  display_rank: number;
}

// ---- Hidden Benchmark (server-only) ----
export interface IncidentBenchmark {
  incident_id: number;
  disruption_magnitude: number;
  reference_impact_score: number;
  reference_rank: number;
  benchmark_version: string;
}

// ---- Experiment Variant ----
export type ExperimentVariant = 'severity_only' | 'spatial_impact';

// ---- Experiment Session ----
export interface ExperimentSession {
  id: string;
  participant_id: string;
  scenario_id: string;
  variant: ExperimentVariant;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  successful: boolean | null;
  selected_incident_ids: number[] | null;
  precision_at_3: number | null;
  ndcg_at_3: number | null;
  flagsmith_event_status: string;
}

// ---- Triage Submission Payload ----
export interface TriageSubmission {
  participant_id: string;
  scenario_id: string;
  selected_incident_ids: [number, number, number]; // exactly 3
}

// ---- Submission Response ----
export interface SubmissionResult {
  success: boolean;
  matches: number;
  precision_at_3: number;
  duration_seconds: number;
  benchmark_top3_ids?: number[]; // Deprecated/omitted in production to prevent ground truth leakage
  selected_ids: number[];
}

// ---- Internal Experiment Health & Infrastructure Metrics ----
export interface ExperimentHealthMetrics {
  total_exposures: number;
  control_exposures: number;
  treatment_exposures: number;
  control_allocation_pct: number;
  treatment_allocation_pct: number;
  successful_tasks: number;
  failed_submissions: number;
  duplicate_attempts_blocked: number;
  event_ingestion_status: 'dispatched_and_flushed' | 'healthy' | 'degraded';
  events_dispatched_count: number;
  assignment_consistency_pct: number;
}

// ---- Analytics Aggregates ----
export interface ExperimentAnalytics {
  total_participants: number;
  control_count: number;
  treatment_count: number;
  control_success_rate: number;
  treatment_success_rate: number;
  absolute_lift: number;
  relative_lift: number;
  control_avg_duration: number;
  treatment_avg_duration: number;
  control_avg_precision: number;
  treatment_avg_precision: number;
  completion_rate: number;
  health: ExperimentHealthMetrics;
  is_simulated_included?: boolean;
}
