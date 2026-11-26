import { NextResponse } from 'next/server';
import type { Flags } from '@flagsmith/nodejs';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '@/lib/supabase/server';
import { evaluateSubmission } from '@/lib/benchmark/evaluator';
import { SCENARIO_ID } from '@/lib/experiment/identity';
import { getFlagsmithServer, isExperimentVariant, STRATEGY_FLAG_NAME, trackServerEvent } from '@/lib/flagsmith/server';
import { METRIC_NAMES } from '@/lib/flagsmith/metrics';
import { validateRemoteConfig } from '@/lib/flagsmith/config-schema';
import { verifyModelConfigSignature } from '@/lib/flagsmith/model-config-signature';
import { SubmissionResult } from '@/types';

export const dynamic = 'force-dynamic';

type ConsequenceCapture = number;

type ConsequenceIncident = {
  id: number;
  context?: {
    composite_c?: number;
    population_index?: number;
    facility_index?: number;
    accessibility_index?: number;
    population_exposed?: number;
    hospital_count?: number;
    fire_station_count?: number;
  };
};

function computeConsequenceCapture(
  selectedIds: number[],
  benchmarkTop3Ids: number[],
  incidents: ConsequenceIncident[],
): ConsequenceCapture {
  const consequence = (incident: ConsequenceIncident | undefined) => {
    const context = incident?.context;
    if (!context) return 0;
    if (typeof context.composite_c === 'number') return Math.max(0, Math.min(1, context.composite_c));
    const population = Number(context.population_index) || 0;
    const facilities = Number(context.facility_index) || 0;
    const accessibility = Number(context.accessibility_index) || 0;
    return Math.max(0, Math.min(1, 0.6 * population + 0.3 * facilities + 0.1 * accessibility));
  };
  const pickedMean = selectedIds.reduce((sum, id) => sum + consequence(incidents.find((incident) => incident.id === id)), 0) / 3;
  const benchmarkMean = benchmarkTop3Ids.reduce((sum, id) => sum + consequence(incidents.find((incident) => incident.id === id)), 0) / 3;
  return benchmarkMean > 0 ? Math.max(0, Math.min(1, pickedMean / benchmarkMean)) : 0;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { participant_id, scenario_id = SCENARIO_ID, selected_incident_ids } = body;

    // 1. Strict Payload & Identity Validation
    if (!participant_id || typeof participant_id !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing participant_id' }, { status: 400 });
    }

    if (!Array.isArray(selected_incident_ids)) {
      return NextResponse.json({ error: 'selected_incident_ids must be an array' }, { status: 400 });
    }

    // Require exactly 3 unique numeric IDs
    const uniqueIds = Array.from(new Set(selected_incident_ids.map(Number))).filter(
      (id) => !isNaN(id) && id >= 1 && id <= 25
    );

    if (uniqueIds.length !== 3) {
      return NextResponse.json(
        { error: 'Selection integrity violation: exactly 3 unique valid incident IDs (1-25) required' },
        { status: 400 }
      );
    }

    const serverNow = new Date();
    let durationSeconds = 45.0; // fallback if session unrecorded

    // 2. Fetch Session & Enforce Server-Clock Timing (Anti-tampering)
    let session = null;
    if (supabaseAdmin) {
      const { data: dbSession } = await supabaseAdmin
        .from('experiment_sessions')
        .select('*')
        .eq('participant_id', participant_id)
        .eq('scenario_id', scenario_id)
        .maybeSingle();
      session = dbSession;
    } else {
      const { getLocalSession } = await import('@/lib/experiment/session-store');
      session = getLocalSession(participant_id, scenario_id);
    }

    if (session) {
      // Prevent duplicate submissions / variant switching
      if (session.completed_at) {
        return NextResponse.json(
          { error: 'Duplicate submission rejected: experiment session already completed' },
          { status: 409 }
        );
      }

      const startedAt = new Date(session.started_at);
      // Strictly unrounded server-measured duration for enforcement and cohort classification
      durationSeconds = (serverNow.getTime() - startedAt.getTime()) / 1000;

      // Enforce 120s limit (+ 8s network grace) on server clock: strictly > 128 seconds rejected
      if (durationSeconds > 128) {
        return NextResponse.json(
          { error: 'Submission window expired (exceeded 128-second acceptance limit)' },
          { status: 408 }
        );
      }
    } else {
      return NextResponse.json({ error: 'No active participant session. Start the task before submitting.' }, { status: 403 });
    }

    const flagsmith = await getFlagsmithServer();
    if (!flagsmith) {
      return NextResponse.json({ error: 'Flagsmith assignment service is unavailable.' }, { status: 503 });
    }

    let identityFlags: Flags;
    try {
      identityFlags = await flagsmith.getIdentityFlags(participant_id);
    } catch (error) {
      console.error('[Submissions] Flagsmith identity evaluation failed:', error);
      return NextResponse.json({ error: 'Flagsmith could not verify the stored session assignment.' }, { status: 503 });
    }

    const strategyFlag = identityFlags.flags[STRATEGY_FLAG_NAME];
    const assignedVariant = strategyFlag?.value;
    if (
      !strategyFlag ||
      strategyFlag.isDefault ||
      !strategyFlag.enabled ||
      !strategyFlag.experiment?.inExperiment ||
      !isExperimentVariant(assignedVariant)
    ) {
      return NextResponse.json({ error: 'Participant has no valid Flagsmith experiment assignment.' }, { status: 403 });
    }
    if (session.variant !== assignedVariant) {
      return NextResponse.json({ error: 'Stored session variant does not match the Flagsmith assignment.' }, { status: 409 });
    }

    const scoringConfigResult = validateRemoteConfig(body.model_config, assignedVariant);
    if (!scoringConfigResult.valid || !scoringConfigResult.config ||
        !verifyModelConfigSignature(participant_id, session.started_at, scoringConfigResult.config, String(body.model_config_signature || ''))) {
      return NextResponse.json({ error: 'Run config signature is missing or invalid. Resume from the same participant session.' }, { status: 403 });
    }
    const scoringConfig = scoringConfigResult.config;

    // 3. Load the recomputed, server-only v2.0 reference benchmark.
    const benchmarkPath = path.join(process.cwd(), 'data', 'benchmarks_server_only.json');
    if (!fs.existsSync(benchmarkPath)) throw new Error('Server-only benchmark file is missing; run npm run benchmark:recompute.');
    const benchmarkRows = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8')) as { incident_id: number; reference_rank: number }[];
    const benchmarkTop3Ids = benchmarkRows
      .sort((a, b) => a.reference_rank - b.reference_rank)
      .slice(0, 3)
      .map((row) => row.incident_id);
    if (benchmarkTop3Ids.length !== 3) throw new Error('Server-only benchmark must contain three ranked incidents.');

    // 4. Compute Scientific Metrics Server-Side
    const evalResult = evaluateSubmission(uniqueIds, benchmarkTop3Ids, scoringConfig.top3_pass_matches);

    // Compute Post-Task Consequence & Critical Infrastructure Diagnostic Metrics (Estimated Exposure)
    const incidentsPath = path.join(process.cwd(), 'public', 'geo', 'incidents_data.json');
    let totalEstimatedPopExposure = 0;
    let totalHospsCovered = 0;
    let totalFireCovered = 0;
    let consequenceCapture: ConsequenceCapture = 0;
    if (fs.existsSync(incidentsPath)) {
      const allIncidents = JSON.parse(fs.readFileSync(incidentsPath, 'utf8')) as ConsequenceIncident[];
      consequenceCapture = computeConsequenceCapture(uniqueIds, benchmarkTop3Ids, allIncidents);
      uniqueIds.forEach((id: number) => {
        const found = allIncidents.find((incident) => incident.id === id);
        if (found?.context) {
          totalEstimatedPopExposure += found.context.population_exposed || 0;
          totalHospsCovered += found.context.hospital_count || 0;
          totalFireCovered += found.context.fire_station_count || 0;
        }
      });
    }

    // 5. Persist Session in Database BEFORE Analytics Event Dispatch (Rule 18)
    if (supabaseAdmin) {
      await supabaseAdmin
        .from('experiment_sessions')
        .update({
          completed_at: serverNow.toISOString(),
          duration_seconds: durationSeconds,
          successful: evalResult.successful,
          selected_incident_ids: uniqueIds,
          precision_at_3: evalResult.precision_at_3,
          flagsmith_event_status: 'dispatched',
        })
        .eq('participant_id', participant_id)
        .eq('scenario_id', scenario_id);
    } else {
      const { saveLocalSession } = await import('@/lib/experiment/session-store');
      saveLocalSession({
        id: participant_id,
        participant_id,
        scenario_id,
        variant: session?.variant || 'unknown',
        started_at: session?.started_at || serverNow.toISOString(),
        completed_at: serverNow.toISOString(),
        duration_seconds: durationSeconds,
        successful: null,
        selected_incident_ids: uniqueIds,
        precision_at_3: null,
        flagsmith_event_status: 'dispatched',
        is_simulated: session?.is_simulated || false,
        assignment_source: session?.assignment_source || 'deterministic_fallback',
        flagsmith_exposure_recorded: session?.flagsmith_exposure_recorded || false,
      });
    }

    // Flagsmith owns experiment measurement; all conversion events use the participant identity.
    const submittedSent = await trackServerEvent(participant_id, METRIC_NAMES.submitted, consequenceCapture);
    const successSent = evalResult.successful
      ? await trackServerEvent(participant_id, METRIC_NAMES.success)
      : false;
    const durationSent = await trackServerEvent(participant_id, METRIC_NAMES.duration, durationSeconds);

    // 7. Return Evaluation Payload (Hidden benchmark scores remain isolated on server)
    // Eligibility & cohort classification uses strictly unrounded durationSeconds <= 120
    const within120Limit = durationSeconds <= 120;
    const responsePayload: SubmissionResult & { 
      within_standard_deadline: boolean;
      consequence_metrics: {
        consequence_capture: ConsequenceCapture;
        population_protected: number; // Retained for backwards compatibility in UI types
        estimated_population_exposure: number;
        hospitals_covered: number;
        fire_stations_covered: number;
        critical_infra_coverage_score: number;
      };
      flagsmith_events: {
        submitted: boolean;
        success: boolean;
        duration: boolean;
        last_event: string;
        last_value: number;
      };
    } = {
      success: evalResult.successful,
      matches: evalResult.matches,
      precision_at_3: evalResult.precision_at_3,
      duration_seconds: Number(durationSeconds.toFixed(2)),
      within_standard_deadline: within120Limit,
      selected_ids: uniqueIds,
      consequence_metrics: {
        consequence_capture: consequenceCapture,
        population_protected: totalEstimatedPopExposure,
        estimated_population_exposure: totalEstimatedPopExposure,
        hospitals_covered: totalHospsCovered,
        fire_stations_covered: totalFireCovered,
        critical_infra_coverage_score: Number(((totalHospsCovered * 2 + (totalEstimatedPopExposure / 20000)) / 6 * 100).toFixed(1)),
      },
      flagsmith_events: {
        submitted: submittedSent,
        success: successSent,
        duration: durationSent,
        last_event: METRIC_NAMES.duration,
        last_value: Number(durationSeconds.toFixed(2)),
      },
    };

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('Error in POST /api/submissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
