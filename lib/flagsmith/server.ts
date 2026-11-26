import { Flagsmith } from '@flagsmith/nodejs';
import { ExperimentRemoteConfig, validateRemoteConfig } from '@/lib/flagsmith/config-schema';
import type { ExperimentVariant } from '@/types';

const serverApiKey = process.env.FLAGSMITH_SERVER_KEY || process.env.NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY;
export const STRATEGY_FLAG_NAME = process.env.NEXT_PUBLIC_FLAG_STRATEGY || 'incident_prioritization_strategy';

export function isExperimentVariant(value: unknown): value is ExperimentVariant {
  return value === 'severity_only' || value === 'spatial_impact';
}

let flagsmithInstance: Flagsmith | null = null;

/**
 * Initializes server-side Flagsmith instance.
 * Safe for serverless environments — instance is module-level cached.
 *
 * @flagsmith/nodejs v9.5.0 API, verified in the installed SDK types:
 *   getEnvironmentFlags()                         → flags without identity
 *   getIdentityFlags(identifier)                  → identity-evaluated flags
 *   getExperimentFlag(featureName, identifier)     → flag and exposure for enrolled identities
 *   trackEvent(event, { identifier, value })       → queue a conversion event
 *   trackExposureEvent(featureName, { identifier })→ queue an explicit exposure event
 *   flushEvents()                                  → flush buffered events
 */
export async function getFlagsmithServer(): Promise<Flagsmith | null> {
  if (!serverApiKey) {
    console.warn('[Flagsmith Server] No server API key configured — event tracking disabled.');
    return null;
  }

  if (!flagsmithInstance) {
    try {
      flagsmithInstance = new Flagsmith({
        environmentKey: serverApiKey,
        enableAnalytics: true,
        enableEvents: true,
      });
    } catch (err) {
      console.warn('[Flagsmith Server] Init error:', err);
      return null;
    }
  }

  return flagsmithInstance;
}

/** Read the same Flagsmith model value for server-side metric scoring. */
export async function getServerModelConfig(participantId: string, variant: 'severity_only' | 'spatial_impact'): Promise<ExperimentRemoteConfig> {
  const fs = await getFlagsmithServer();
  if (!fs) throw new Error('Flagsmith server SDK is unavailable; cannot verify the task scoring rule.');
  const identityFlags = await fs.getIdentityFlags(participantId);
  const value = identityFlags.getFeatureValue(process.env.NEXT_PUBLIC_FLAG_MODEL_CONFIG || 'incident_prioritization_model_config');
  let raw: unknown = value;
  if (typeof value === 'string') {
    try { raw = JSON.parse(value); }
    catch { throw new Error('Flagsmith model config flag is not valid JSON.'); }
  }
  const result = validateRemoteConfig(raw, variant);
  if (!result.valid || !result.config) throw new Error(result.error || 'Flagsmith model config could not be validated.');
  return result.config;
}

/**
 * Dispatches verified conversion events server-side only after database persistence.
 *
 * Uses @flagsmith/nodejs v9.5.0 official API:
 *   - trackEvent(eventName, { identifier: participantId, value: number })
 *   - flushEvents() to synchronously deliver before route completes to https://events.api.flagsmith.com/
 */
export async function trackServerEvent(
  participantId: string,
  eventName: string,
  value?: number
): Promise<boolean> {
  const fs = await getFlagsmithServer();
  if (!fs) {
    return false;
  }

  try {
    // Official @flagsmith/nodejs signature: trackEvent(event: string, opts?: { identifier?: string; value?: FlagsmithValue })
    fs.trackEvent(eventName, {
      identifier: participantId,
      value: value !== undefined ? value : null,
    });

    // Synchronously deliver buffered event to https://events.api.flagsmith.com/
    await fs.flushEvents();

    console.log(`[Flagsmith Server] Event dispatched & flushed: ${eventName} (identity=${participantId}, value=${value})`);
    return true;
  } catch (err) {
    console.warn(`[Flagsmith Server] Failed to dispatch event ${eventName}:`, err);
    return false;
  }
}
