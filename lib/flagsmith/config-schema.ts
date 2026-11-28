export type ExperimentVariant = 'severity_only' | 'spatial_impact';

export type ExperimentControlState =
  | 'connecting'
  | 'experiment_active'
  | 'experiment_ended'
  | 'experiment_unavailable'
  | 'invalid_configuration'
  | 'experiment_not_enrolled'
  | 'unassigned';

export interface ExperimentRemoteConfig {
  experiment_id: number;
  experiment_version: string;
  strategy: ExperimentVariant;
  population_weight: number;
  facility_weight: number;
  accessibility_weight: number;
  mix_factor: number;
  top3_pass_matches: number;
  selection_limit: number;
  task_time_limit_seconds: number;
  benchmark_version: string;
  configuration_version: string;
  is_remote_verified: boolean;
}

export const DEFAULT_EXPERIMENT_CONFIG: Record<ExperimentVariant, Omit<ExperimentRemoteConfig, 'is_remote_verified'>> = {
  severity_only: {
    experiment_id: 581,
    experiment_version: 'v1.0',
    strategy: 'severity_only',
    population_weight: 0.0,
    facility_weight: 0.0,
    accessibility_weight: 0.0,
    mix_factor: 0.45,
    top3_pass_matches: 2,
    selection_limit: 3,
    task_time_limit_seconds: 120,
    benchmark_version: 'v2.0',
    configuration_version: 'default_v1',
  },
  spatial_impact: {
    experiment_id: 581,
    experiment_version: 'v1.0',
    strategy: 'spatial_impact',
    population_weight: 0.60,
    facility_weight: 0.30,
    accessibility_weight: 0.10,
    mix_factor: 0.45,
    top3_pass_matches: 2,
    selection_limit: 3,
    task_time_limit_seconds: 120,
    benchmark_version: 'v2.0',
    configuration_version: 'default_v1',
  },
};

/**
 * Validates remote config schema and weight constraints.
 */
export function validateRemoteConfig(
  raw: any,
  assignedVariant: ExperimentVariant
): { valid: boolean; config?: ExperimentRemoteConfig; error?: string } {
  if (!raw || typeof raw !== 'object') {
    // If remote flag returned string variant without embedded JSON config, build validated schema for assigned variant
    const def = DEFAULT_EXPERIMENT_CONFIG[assignedVariant];
    return {
      valid: true,
      config: {
        ...def,
        strategy: assignedVariant,
        is_remote_verified: false,
      },
    };
  }

  const strategyRaw = raw.strategy || assignedVariant;
  if (strategyRaw !== 'severity_only' && strategyRaw !== 'spatial_impact') {
    return { valid: false, error: `Invalid strategy: ${strategyRaw}` };
  }
  // Narrowed to ExperimentVariant after the guard above.
  const strategy: ExperimentVariant = strategyRaw;

  const pop = typeof raw.population_weight === 'number' ? raw.population_weight : DEFAULT_EXPERIMENT_CONFIG[strategy].population_weight;
  const fac = typeof raw.facility_weight === 'number' ? raw.facility_weight : DEFAULT_EXPERIMENT_CONFIG[strategy].facility_weight;
  const acc = typeof raw.accessibility_weight === 'number' ? raw.accessibility_weight : DEFAULT_EXPERIMENT_CONFIG[strategy].accessibility_weight;
  const mix = typeof raw.mix_factor === 'number' ? raw.mix_factor : DEFAULT_EXPERIMENT_CONFIG[strategy].mix_factor;
  const passMatches = typeof raw.top3_pass_matches === 'number' ? raw.top3_pass_matches : DEFAULT_EXPERIMENT_CONFIG[strategy].top3_pass_matches;

  // Validate math constraints
  if (strategy === 'spatial_impact') {
    const weightSum = Number((pop + fac + acc).toFixed(2));
    if (Math.abs(weightSum - 1.0) > 0.05) {
      return { valid: false, error: `Context weights do not sum to 1.0: ${pop}+${fac}+${acc}=${weightSum}` };
    }
  }
  if (mix < 0 || mix > 1 || !Number.isInteger(passMatches) || passMatches < 1 || passMatches > 3) {
    return { valid: false, error: `Invalid mix_factor/top3_pass_matches: ${mix}/${passMatches}` };
  }

  return {
    valid: true,
    config: {
      experiment_id: raw.experiment_id || 581,
      experiment_version: raw.experiment_version || 'v1.0',
      strategy,
      population_weight: pop,
      facility_weight: fac,
      accessibility_weight: acc,
      mix_factor: mix,
      top3_pass_matches: passMatches,
      selection_limit: raw.selection_limit || 3,
      task_time_limit_seconds: raw.task_time_limit_seconds || 120,
      benchmark_version: raw.benchmark_version || 'v2.0',
      configuration_version: raw.configuration_version || 'v1.0',
      is_remote_verified: true,
    },
  };
}
