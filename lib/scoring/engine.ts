import { Incident, IncidentContext, IncidentWithContext, ExperimentVariant } from '@/types';
import { ExperimentRemoteConfig, DEFAULT_EXPERIMENT_CONFIG } from '@/lib/flagsmith/config-schema';

/**
 * Control Variant A: S_A = Severity (no spatial weighting)
 * severity_base_weight=1.0, spatial_adjustment=0.0 → score = severity_score
 */
export function calculateSeverityScore(incident: Incident): number {
  return Number(incident.severity_score.toFixed(2));
}

/**
 * Treatment Variant B: S_B = Severity * ((1 - mix_factor) + mix_factor * C)
 * C = population_weight*P + facility_weight*F + accessibility_weight*A
 *
 * Weights come from ExperimentRemoteConfig sourced from Flagsmith, not from local constants.
 * Default values (0.60/0.30/0.10/0.45) are only used when the caller passes no config
 * (e.g. benchmark generator — which intentionally uses fixed defaults for independence).
 */
export function calculateSpatialScore(
  incident: Incident,
  context: IncidentContext,
  config?: Pick<
    ExperimentRemoteConfig,
    'population_weight' | 'facility_weight' | 'accessibility_weight' | 'mix_factor'
  >
): number {
  const cfg = config ?? DEFAULT_EXPERIMENT_CONFIG['spatial_impact'];
  const P = context.population_index;
  const F = context.facility_index;
  const A = context.accessibility_index;
  const C = cfg.population_weight * P + cfg.facility_weight * F + cfg.accessibility_weight * A;
  const S_B = incident.severity_score * ((1 - cfg.mix_factor) + cfg.mix_factor * C);
  return Number(S_B.toFixed(2));
}

/**
 * Ranks all incidents descending based on the assigned Flagsmith experiment variant.
 * remoteConfig is mandatory when variant is 'spatial_impact'; the scoring weights are
 * read from the config, which must have been obtained from Flagsmith (is_remote_verified).
 */
export function rankIncidents(
  incidents: IncidentWithContext[],
  variant: ExperimentVariant,
  remoteConfig?: ExperimentRemoteConfig
): IncidentWithContext[] {
  const ranked = [...incidents].map((item) => {
    let display_score: number;
    if (variant === 'spatial_impact') {
      display_score = calculateSpatialScore(item, item.context, remoteConfig);
    } else {
      display_score = calculateSeverityScore(item);
    }

    return {
      ...item,
      display_score,
      display_rank: 0,
    };
  });

  // Sort strictly descending by display_score
  ranked.sort((a, b) => b.display_score - a.display_score);

  // Assign sequential 1-based display rank
  return ranked.map((item, index) => ({
    ...item,
    display_rank: index + 1,
  }));
}

/**
 * Returns a human-understandable explanation for the operator.
 */
export function getStrategyExplanation(variant: ExperimentVariant): string {
  if (variant === 'spatial_impact') {
    return 'Multivariate Spatial Optimization: Incidents are ranked combining technical severity with population density, adjacent trauma/emergency facilities, and road network reachability. Scoring weights are remotely configured by Flagsmith.';
  }
  return 'Standard Technical Severity: Incidents are ranked strictly in descending order of their reported engineering severity rating.';
}
