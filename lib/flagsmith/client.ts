import flagsmith from '@flagsmith/flagsmith';
import { ExperimentVariant } from '@/types';
import {
  ExperimentControlState,
  ExperimentRemoteConfig,
  validateRemoteConfig,
} from '@/lib/flagsmith/config-schema';

const STRATEGY_FLAG_NAME = process.env.NEXT_PUBLIC_FLAG_STRATEGY || 'incident_prioritization_strategy';
export const MODEL_CONFIG_FLAG_NAME = process.env.NEXT_PUBLIC_FLAG_MODEL_CONFIG || 'incident_prioritization_model_config';
export const FALLBACK_FLAG_NAME = process.env.NEXT_PUBLIC_FLAG_CONSEQUENCE_FALLBACK || 'incident_consequence_fallback_enabled';
export { METRIC_NAMES } from '@/lib/flagsmith/metrics';

let lastEventSent: { name: string; value?: number; at: string } | null = null;
export function getLastFlagsmithEvent() { return lastEventSent; }

export interface AssignmentResult {
  variant: ExperimentVariant;
  source: 'flagsmith_remote' | 'deterministic_fallback';
  flagsmith_exposure_recorded: boolean;
  /** State machine outcome — governs whether experiment participation is permitted. */
  controlState: ExperimentControlState;
  /** Validated remote config (only populated when controlState === 'experiment_active'). */
  remoteConfig?: ExperimentRemoteConfig;
}

/**
 * Initialises Flagsmith using the official @flagsmith/flagsmith SDK v12.6.0.
 *
 * Fail-closed state machine:
 *   experiment_active         → remote Flagsmith returned a valid variant; participant may proceed.
 *   experiment_unavailable    → Flagsmith SDK threw, is unreachable, or no env key is configured.
 *   invalid_configuration     → Flagsmith returned an unrecognised variant value.
 *   experiment_not_enrolled   → Flag exists but participant is outside the experiment traffic allocation.
 *   connecting                → Transient in-progress state (set by callers before this promise resolves).
 *
 * No silent deterministic fallback: when Flagsmith is unavailable the caller receives
 * experiment_unavailable and MUST refuse experiment participation.
 */
export async function initFlagsmith(participantId: string, sessionConfig?: ExperimentRemoteConfig): Promise<AssignmentResult> {
  const envKey = process.env.NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY;

  // No environment key → cannot reach Flagsmith at all.
  if (!envKey || envKey.trim() === '' || envKey.length < 5) {
    console.warn('[Flagsmith] No NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY — experiment_unavailable.');
    return {
      variant: 'severity_only', // placeholder, must not be used
      source: 'deterministic_fallback',
      flagsmith_exposure_recorded: false,
      controlState: 'experiment_unavailable',
    };
  }

  try {
    // Identity must be set at init time so getExperimentFlag can record exposure.
    await flagsmith.init({
      environmentID: envKey.trim(),
      cacheFlags: false,         // always fetch fresh flags for each participant
      enableAnalytics: true,     // required for trackExposureEvent / getExperimentFlag
      enableEvents: true,
    });
    await flagsmith.identify(participantId);

    // Read assignment without exposure; exposure belongs immediately before rendering the ranking.
    const experimentFlag = flagsmith.getAllFlags()?.[STRATEGY_FLAG_NAME] ?? null;
    let exposureRecorded = false;

    // Resolve the multivariate variant string.
    const rawValue = experimentFlag?.value ?? flagsmith.getValue(STRATEGY_FLAG_NAME);

    // If the experiment has ended or flag has no active experiment (e.g. rolled out variant post-experiment):
    // Enter post-experiment mode: serve the shipped strategy without counting as an experiment exposure.
    const validVariant = rawValue === 'severity_only' || rawValue === 'spatial_impact';
    const noActiveExperiment =
      experimentFlag != null &&
      (experimentFlag.experiment == null || experimentFlag.experiment?.inExperiment === false);

    if (validVariant && noActiveExperiment) {
      const variant: ExperimentVariant = rawValue;
      let configValue: unknown = sessionConfig ?? null;
      if (!sessionConfig) try {
        const rawConfig = flagsmith.getValue(MODEL_CONFIG_FLAG_NAME);
        configValue = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig;
      } catch {}
      const configResult = validateRemoteConfig(configValue, variant);
      console.log(`[Flagsmith] experiment_ended: variant=${variant}, serving shipped strategy post-experiment.`);
      return {
        variant,
        source: 'flagsmith_remote',
        flagsmith_exposure_recorded: false,
        controlState: 'experiment_ended',
        remoteConfig: configResult.config,
      };
    }

    // If the flag exists but inExperiment is false, the participant is outside the traffic allocation.
    if (experimentFlag != null && experimentFlag.experiment?.inExperiment === false) {
      console.warn('[Flagsmith] Participant not enrolled in experiment traffic allocation.');
      return {
        variant: 'severity_only', // placeholder, must not be used
        source: 'deterministic_fallback',
        flagsmith_exposure_recorded: false,
        controlState: 'experiment_not_enrolled',
      };
    }

    // Any value other than the two known variants is a configuration error — fail closed.
    if (rawValue !== 'severity_only' && rawValue !== 'spatial_impact') {
      console.error(`[Flagsmith] Unrecognised variant value "${String(rawValue)}" — invalid_configuration.`);
      return {
        variant: 'severity_only', // placeholder, must not be used
        source: 'deterministic_fallback',
        flagsmith_exposure_recorded: false,
        controlState: 'invalid_configuration',
      };
    }

    const variant: ExperimentVariant = rawValue;

    // Build validated remote config from confirmed variant assignment.
    let configValue: unknown = sessionConfig ?? null;
    if (!sessionConfig) try {
      const rawConfig = flagsmith.getValue(MODEL_CONFIG_FLAG_NAME);
      configValue = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig;
    } catch (configError) {
      console.warn('[Flagsmith] Model config missing or invalid; using validated defaults.', configError);
    }
    const configResult = validateRemoteConfig(configValue, variant);
    if (!configResult.valid || !configResult.config) {
      console.error('[Flagsmith] Config validation failed:', configResult.error);
      return {
        variant: 'severity_only',
        source: 'deterministic_fallback',
        flagsmith_exposure_recorded: false,
        controlState: 'invalid_configuration',
      };
    }

    console.log(`[Flagsmith] experiment_active: variant=${variant}, identity=${participantId}, model_config=${JSON.stringify(configResult.config)}`);
    return {
      variant,
      source: 'flagsmith_remote',
      flagsmith_exposure_recorded: exposureRecorded,
      controlState: 'experiment_active',
      remoteConfig: configResult.config,
    };
  } catch (err) {
    // SDK threw (network error, timeout, bad key, etc.) → fail closed.
    console.error('[Flagsmith] SDK init error — experiment_unavailable:', err);
    return {
      variant: 'severity_only', // placeholder, must not be used
      source: 'deterministic_fallback',
      flagsmith_exposure_recorded: false,
      controlState: 'experiment_unavailable',
    };
  }
}

export function isConsequenceFallbackEnabled(): boolean {
  return flagsmith.hasFeature(FALLBACK_FLAG_NAME);
}

/** Call only at the moment the assigned ranking is committed to the visible UI. */
export async function recordDisplayedExperiment(participantId: string): Promise<{ variant: ExperimentVariant; exposed: boolean }> {
  const value = flagsmith.getExperimentFlag(STRATEGY_FLAG_NAME);
  const variant: ExperimentVariant = value?.value === 'spatial_impact' ? 'spatial_impact' : 'severity_only';
  const exposed = Boolean(value?.experiment?.inExperiment);
  if (exposed) {
    localStorage.setItem('terralens_flagsmith_exposure', JSON.stringify({ variant, recorded: true, at: new Date().toISOString() }));
    await flagsmith.flushEvents();
  }
  return { variant, exposed };
}

/**
 * Get current variant from evaluated Flagsmith state (after init).
 */
export function getStrategy(): ExperimentVariant {
  try {
    const val = flagsmith.getValue(STRATEGY_FLAG_NAME);
    if (val === 'spatial_impact') return 'spatial_impact';
    return 'severity_only';
  } catch {
    return 'severity_only';
  }
}

/**
 * Track a conversion event in Flagsmith (server-initiated from route.ts).
 * Uses trackEvent() — only valid after identify()/init() with enableAnalytics:true.
 */
export async function trackTriageEvent(eventName: string, value?: number): Promise<void> {
  try {
    if (typeof flagsmith.trackEvent === 'function') {
      if (value !== undefined) {
        flagsmith.trackEvent(eventName, { value });
      } else {
        flagsmith.trackEvent(eventName);
      }
      await flagsmith.flushEvents();
      lastEventSent = { name: eventName, ...(value !== undefined ? { value } : {}), at: new Date().toISOString() };
      console.log(`[Flagsmith] trackEvent flushed: ${eventName}`, value !== undefined ? { value } : '');
    } else {
      console.warn('[Flagsmith] trackEvent not available on this SDK instance');
    }
  } catch (err) {
    console.warn(`[Flagsmith] trackEvent error for ${eventName}:`, err);
  }
}
