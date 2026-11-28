import { NextResponse } from 'next/server';
import type { Flags } from '@flagsmith/nodejs';
import { supabaseAdmin } from '@/lib/supabase/server';
import { SCENARIO_ID } from '@/lib/experiment/identity';
import { getLocalSession, saveLocalSession } from '@/lib/experiment/session-store';
import { getFlagsmithServer, getServerModelConfig, isExperimentVariant, STRATEGY_FLAG_NAME } from '@/lib/flagsmith/server';
import { validateRemoteConfig } from '@/lib/flagsmith/config-schema';
import { signModelConfig } from '@/lib/flagsmith/model-config-signature';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      participant_id,
      scenario_id = SCENARIO_ID,
      variant,
      assignment_source = 'deterministic_fallback',
      flagsmith_exposure_recorded = false,
      started_at = null,
    } = body;

    if (!participant_id || typeof participant_id !== 'string' || !variant) {
      return NextResponse.json({ error: 'Missing participant_id or variant' }, { status: 400 });
    }

    if (process.env.NODE_ENV === 'production' && !/^(qa_sim|demo|pilot)_/.test(participant_id)) {
      return NextResponse.json({ error: 'Production sessions require a qa_sim_, demo_, or pilot_ participant_id.' }, { status: 403 });
    }

    const isSimulated = participant_id.startsWith('qa_sim_');
    if (body.is_simulated === true && !isSimulated) {
      return NextResponse.json({ error: 'Simulated sessions require a qa_sim_ participant_id.' }, { status: 400 });
    }

    if (!isExperimentVariant(variant)) {
      return NextResponse.json({ error: 'Invalid experiment variant' }, { status: 400 });
    }

    const isPostExperiment = assignment_source === 'post_experiment';

    // Reject sessions from deterministic fallback — only Flagsmith-remote assignments are experiment observations.
    // 'cached' is accepted because it was established by a prior flagsmith_remote assignment in this browser session.
    if (assignment_source === 'deterministic_fallback') {
      return NextResponse.json(
        { error: 'Session rejected: deterministic_fallback assignment is not an experiment observation. Only flagsmith_remote assignments are accepted.' },
        { status: 403 }
      );
    }

    const flagsmith = await getFlagsmithServer();
    if (!flagsmith) {
      return NextResponse.json({ error: 'Flagsmith assignment service is unavailable.' }, { status: 503 });
    }

    let identityFlags: Flags;
    try {
      identityFlags = await flagsmith.getIdentityFlags(participant_id);
    } catch (error) {
      console.error('[Sessions] Flagsmith identity evaluation failed:', error);
      return NextResponse.json({ error: 'Flagsmith could not verify this participant assignment.' }, { status: 503 });
    }

    const strategyFlag = identityFlags.flags[STRATEGY_FLAG_NAME];
    const assignedVariant = strategyFlag?.value;
    const inExperiment = Boolean(strategyFlag?.experiment?.inExperiment);

    if (
      !strategyFlag ||
      strategyFlag.isDefault ||
      !strategyFlag.enabled ||
      (!inExperiment && !isPostExperiment) ||
      !isExperimentVariant(assignedVariant)
    ) {
      return NextResponse.json({ error: 'Participant has no valid Flagsmith experiment assignment.' }, { status: 403 });
    }
    if (variant !== assignedVariant) {
      return NextResponse.json({ error: 'Claimed variant does not match the Flagsmith assignment.' }, { status: 409 });
    }

    const serverConfig = await getServerModelConfig(participant_id, assignedVariant);
    const clientConfigResult = isSimulated
      ? { valid: true, config: serverConfig }
      : validateRemoteConfig(body.model_config, assignedVariant);
    if (!clientConfigResult.valid || !clientConfigResult.config) {
      return NextResponse.json({ error: 'Missing or invalid Flagsmith model config for this run.' }, { status: 400 });
    }
    const now = started_at || new Date().toISOString();

    const respondWithConfig = (session: any, storageBackend: string) => {
      const startedAt = session.started_at || now;
      const signature = signModelConfig(participant_id, startedAt, serverConfig);
      if (clientConfigResult.config) {
        const clientSignature = signModelConfig(participant_id, startedAt, clientConfigResult.config);
        if (signature !== clientSignature) {
          console.warn('[Sessions] Config discrepancy between client and server:', {
            serverConfig,
            clientConfig: clientConfigResult.config
          });
        }
      }
      return NextResponse.json({ ...session, storage_backend: storageBackend, model_config: serverConfig, model_config_signature: signature });
    };

    if (supabaseAdmin) {
      const { data: existing } = await supabaseAdmin
        .from('experiment_sessions')
        .select('*')
        .eq('participant_id', participant_id)
        .eq('scenario_id', scenario_id)
        .maybeSingle();

      if (existing) {
        if (existing.variant !== assignedVariant) {
          return NextResponse.json({ error: 'Stored session variant does not match the Flagsmith assignment.' }, { status: 409 });
        }
        if (Boolean(existing.is_simulated) !== isSimulated) {
          return NextResponse.json({ error: 'Stored session simulation label does not match its qa_sim_ identity.' }, { status: 409 });
        }
        return respondWithConfig(existing, 'supabase');
      }

      const { data: created, error } = await supabaseAdmin
        .from('experiment_sessions')
        .insert({
          participant_id,
          scenario_id,
          variant: assignedVariant,
          started_at: now,
          is_simulated: isSimulated,
        })
        .select()
        .single();

      if (!error && created) {
        return respondWithConfig(created, 'supabase');
      }
      if (error) {
        console.error('[Sessions] Supabase insert failed:', error);
        return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 503 });
      }
    }

    // Local fallback store
    const existingLocal = getLocalSession(participant_id, scenario_id);
    if (existingLocal) {
      if (existingLocal.variant !== assignedVariant) {
        return NextResponse.json({ error: 'Stored session variant does not match the Flagsmith assignment.' }, { status: 409 });
      }
      if (Boolean(existingLocal.is_simulated) !== isSimulated) {
        return NextResponse.json({ error: 'Stored session simulation label does not match its qa_sim_ identity.' }, { status: 409 });
      }
      return respondWithConfig(existingLocal, 'local_sqlite');
    }

    const newLocal = {
      id: participant_id,
      participant_id,
      scenario_id,
      variant: assignedVariant,
      started_at: now,
      completed_at: null,
      duration_seconds: null,
      successful: null,
      selected_incident_ids: null,
      assignment_source,
      flagsmith_exposure_recorded: Boolean(flagsmith_exposure_recorded),
      is_simulated: isSimulated,
    };
    saveLocalSession(newLocal);
    return respondWithConfig(newLocal, 'local_sqlite');
  } catch (error: any) {
    console.error('Error in POST /api/sessions:', error);
    return NextResponse.json({
      error: error?.message || 'Internal server error',
      details: process.env.NODE_ENV !== 'production' ? error?.stack : undefined
    }, { status: 500 });
  }
}
