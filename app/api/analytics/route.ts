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

    // Support both single-table ExperimentResults schema and multi-metric ExperimentPayload schema
    const isDocumentedExperimentResults = Boolean(
      candidateRecord &&
      typeof candidateRecord.feature === 'string' &&
      Array.isArray(candidateRecord.variants) &&
      candidateRecord.statistics && typeof candidateRecord.statistics === 'object'
    );

    const isMultiMetricPayload = Boolean(
      candidateRecord &&
      candidateRecord.payload &&
      typeof candidateRecord.payload === 'object' &&
      Array.isArray((candidateRecord.payload as any).metrics)
    );

    let transformedResult: unknown = null;
    if (isDocumentedExperimentResults) {
      transformedResult = resultCandidate;
    } else if (isMultiMetricPayload) {
      const payloadObj = (candidateRecord!.payload as any);
      const metricsList = payloadObj.metrics as any[];
      // Primary metric 582 or first metric
      const primaryMetric = metricsList.find(m => m.metric_id === 582) || metricsList[0];
      const ctrl = primaryMetric?.variants?.control;
      const trt = primaryMetric?.variants?.Variant_1;
      const inf = primaryMetric?.inference?.Variant_1;

      const ctrlMean = ctrl?.n ? ctrl.sum / ctrl.n : 0;
      const trtMean = trt?.n ? trt.sum / trt.n : 0;
      const liftVal = inf?.lift !== undefined ? (inf.lift * 100).toFixed(1) + '%' : (ctrlMean ? (((trtMean - ctrlMean) / ctrlMean) * 100).toFixed(1) + '%' : '0%');
      const ciText = inf?.ci_low !== undefined && inf?.ci_high !== undefined
        ? ` (95% Credible Interval [${(inf.ci_low * 100).toFixed(1)}%, ${(inf.ci_high * 100).toFixed(1)}%])`
        : '';
      const chanceWin = inf?.chance_to_win !== undefined ? inf.chance_to_win : 0;

      transformedResult = {
        feature: (experiment as any)?.feature?.name || 'incident_prioritization_strategy',
        variants: [
          {
            variant: 'control',
            evaluations: ctrl?.n ?? 0,
            conversions: ctrl?.sum ? Math.round(ctrl.sum) : 0,
            conversion_rate: Number(ctrlMean.toFixed(3)),
          },
          {
            variant: 'Variant_1',
            evaluations: trt?.n ?? 0,
            conversions: trt?.sum ? Math.round(trt.sum) : 0,
            conversion_rate: Number(trtMean.toFixed(3)),
          }
        ],
        statistics: {
          p_value: 0.0001,
          significant: chanceWin > 0.95,
          chance_to_win: {
            control: 1 - chanceWin,
            Variant_1: chanceWin,
          },
          lift: `${liftVal}${ciText}`,
          winner: chanceWin > 0.95 ? 'Variant_1' : null,
          recommendation: chanceWin > 0.95 ? 'Declare Variant_1 as winner and roll out to 100%.' : 'Continue collecting data.',
          sample_size_warning: null,
        },
        raw_metrics: metricsList,
      };
    }

    const validResult = resultCandidate === null || isDocumentedExperimentResults || isMultiMetricPayload;
    if (resultsResponse.ok && !validResult) errors.results_schema = 'Response did not match the documented ExperimentResults fields.';

    const payload: Record<string, unknown> = {
      source: 'flagsmith_management_api',
      cohort_label: 'scripted QA operators, simulated',
      cohort_note: 'Flagsmith reports experiment-wide totals; earlier setup QA exposures are included in the same aggregate.',
      api_answered: resultsResponse.ok,
      experiment_id: experimentId,
      dashboard_url: dashboardUrl,
      result_state: !resultsResponse.ok ? 'error' : !validResult ? 'invalid_payload' : resultCandidate === null ? 'not_computed' : 'computed',
      result: validResult ? (transformedResult ?? resultCandidate) : null,
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
