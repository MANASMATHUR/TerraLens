import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 300 * 1000;
const analyticsCache = new Map<string, { payload: Record<string, unknown>; expiresAt: number }>();

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

/** Reads the live Flagsmith result, exposure, and experiment configuration endpoints. */
export async function GET() {
  const environmentKey = process.env.NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY?.trim();
  const apiKey = process.env.FLAGSMITH_MASTER_API_KEY?.trim();
  const experimentId = process.env.FLAGSMITH_EXPERIMENT_ID?.trim();
  const projectId = process.env.NEXT_PUBLIC_FLAGSMITH_PROJECT_ID?.trim() || '55892';

  if (!environmentKey || !apiKey || !experimentId) {
    return NextResponse.json({
      source: 'flagsmith_management_api',
      api_answered: false,
      error: 'Missing NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY, FLAGSMITH_MASTER_API_KEY, or FLAGSMITH_EXPERIMENT_ID.',
    }, { status: 503 });
  }

  const cachedEntry = analyticsCache.get(experimentId);
  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    return NextResponse.json({ ...cachedEntry.payload, cached: true });
  }

  const base = `https://api.flagsmith.com/api/v1/environments/${encodeURIComponent(environmentKey)}/experiments/${encodeURIComponent(experimentId)}`;
  const headers = { Authorization: `Api-Key ${apiKey}`, Accept: 'application/json' };
  const dashboardUrl = `https://app.flagsmith.com/project/${encodeURIComponent(projectId)}/environment/${encodeURIComponent(environmentKey)}/experiments/${encodeURIComponent(experimentId)}`;

  try {
    const [resultsResponse, exposuresResponse, experimentResponse] = await Promise.all([
      fetch(`${base}/results/`, { headers, cache: 'no-store', signal: AbortSignal.timeout(10000) }),
      fetch(`${base}/exposures/`, { headers, cache: 'no-store', signal: AbortSignal.timeout(10000) }),
      fetch(`${base}/`, { headers, cache: 'no-store', signal: AbortSignal.timeout(10000) }),
    ]);
    const [resultsPayload, exposuresPayload, experimentPayload] = await Promise.all([
      readJson(resultsResponse), readJson(exposuresResponse), readJson(experimentResponse),
    ]);
    const errors: Record<string, string> = {};
    if (!resultsResponse.ok) errors.results = `HTTP ${resultsResponse.status}`;
    if (!exposuresResponse.ok) errors.exposures = `HTTP ${exposuresResponse.status}`;
    if (!experimentResponse.ok) errors.experiment = `HTTP ${experimentResponse.status}`;

    const resultsEnvelope = resultsPayload && typeof resultsPayload === 'object'
      ? resultsPayload as Record<string, unknown>
      : null;
    const exposuresEnvelope = exposuresPayload && typeof exposuresPayload === 'object'
      ? exposuresPayload as Record<string, unknown>
      : null;
    const experiment = experimentPayload && typeof experimentPayload === 'object'
      ? experimentPayload as Record<string, unknown>
      : null;
    const resultCandidate = resultsEnvelope && Object.prototype.hasOwnProperty.call(resultsEnvelope, 'results')
      ? resultsEnvelope.results
      : resultsPayload;
    const candidateRecord = resultCandidate && typeof resultCandidate === 'object'
      ? resultCandidate as Record<string, unknown>
      : null;
    const validResult = resultCandidate === null || Boolean(
      candidateRecord &&
      typeof candidateRecord.feature === 'string' &&
      Array.isArray(candidateRecord.variants) &&
      candidateRecord.statistics && typeof candidateRecord.statistics === 'object'
    );
    if (resultsResponse.ok && !validResult) errors.results_schema = 'Response did not match the documented ExperimentResults fields.';

    const payload: Record<string, unknown> = {
      source: 'flagsmith_management_api',
      cohort_label: 'scripted QA operators, simulated',
      cohort_note: 'Flagsmith reports experiment-wide totals; earlier setup QA exposures are included in the same aggregate.',
      api_answered: resultsResponse.ok,
      experiment_id: experimentId,
      dashboard_url: dashboardUrl,
      result_state: !resultsResponse.ok ? 'error' : !validResult ? 'invalid_payload' : resultCandidate === null ? 'not_computed' : 'computed',
      result: validResult ? resultCandidate : null,
      exposures: exposuresEnvelope?.exposures ?? null,
      experiment: experimentResponse.ok && experiment ? {
        status: experiment.status,
        feature: experiment.feature,
        experiment_rollout: experiment.experiment_rollout,
        metrics: experiment.metrics,
      } : null,
      errors: Object.keys(errors).length ? errors : null,
    };

    if (resultsResponse.ok && Object.keys(errors).length === 0) {
      analyticsCache.set(experimentId, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
    }

    return NextResponse.json({ ...payload, cached: false });
  } catch (error) {
    return NextResponse.json({
      source: 'flagsmith_management_api',
      api_answered: false,
      experiment_id: experimentId,
      dashboard_url: dashboardUrl,
      error: error instanceof Error ? error.message : 'Unknown Flagsmith request failure',
    }, { status: 502 });
  }
}
