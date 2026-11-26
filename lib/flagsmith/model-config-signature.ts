import { createHmac, timingSafeEqual } from 'node:crypto';
import { ExperimentRemoteConfig } from '@/lib/flagsmith/config-schema';

function serializeConfig(config: ExperimentRemoteConfig): string {
  return JSON.stringify({
    strategy: config.strategy,
    population_weight: config.population_weight,
    facility_weight: config.facility_weight,
    accessibility_weight: config.accessibility_weight,
    mix_factor: config.mix_factor,
    top3_pass_matches: config.top3_pass_matches,
    selection_limit: config.selection_limit,
    task_time_limit_seconds: config.task_time_limit_seconds,
    benchmark_version: config.benchmark_version,
    configuration_version: config.configuration_version,
  });
}

function signatureFor(participantId: string, startedAt: string, config: ExperimentRemoteConfig): Buffer {
  const key = process.env.FLAGSMITH_SERVER_KEY;
  if (!key) throw new Error('FLAGSMITH_SERVER_KEY is required to sign the per-run Flagsmith config.');
  return createHmac('sha256', key).update(`${participantId}|${startedAt}|${serializeConfig(config)}`).digest();
}

export function signModelConfig(participantId: string, startedAt: string, config: ExperimentRemoteConfig): string {
  return signatureFor(participantId, startedAt, config).toString('hex');
}

export function verifyModelConfigSignature(participantId: string, startedAt: string, config: ExperimentRemoteConfig, signature: string): boolean {
  try {
    const expected = signatureFor(participantId, startedAt, config);
    const supplied = Buffer.from(signature, 'hex');
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  } catch {
    return false;
  }
}
