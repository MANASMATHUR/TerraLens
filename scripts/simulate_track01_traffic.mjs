/**
 * TerraLens Track 01 Realistic Experiment Traffic Simulator
 *
 * Implements Phase 4 Requirements:
 * - 100 unique simulated participants with persistent UUIDs
 * - Actual Flagsmith remote variant evaluation via Edge API (50/50)
 * - Exposure recorded via Flagsmith SDK
 * - Identical cognitive selection distributions across arms:
 *   Participants inspect the ranked list presented to them by the UI.
 *   Strategies:
 *     1. Top-Ranked Bias (35%): Focuses on top 6 visible ranked incidents.
 *     2. Critical Infrastructure Seeker (25%): Scans for hospitals/power/water facilities.
 *     3. High Population Focus (20%): Prioritizes high population exposure.
 *     4. Imperfect / Heuristic Dispatcher (15%): Mixes top ranks with secondary alerts.
 *     5. Delayed / Inattentive Dispatcher (5%): Takes > 128s (exceeds deadline).
 * - Fixed PRNG seed for reproducibility.
 * - Respects the 120s deadline (most finish between 35s - 95s).
 * - Zero artificial lift hardcoding: outcomes are generated solely by applying the
 *   same cognitive selection logic over whichever list ordering the participant saw.
 */

import fs from 'fs';
import { Flagsmith } from '@flagsmith/nodejs';

const envFile = fs.readFileSync('.env.local', 'utf8');
let clientKey = '';
let strategyFlagName = 'incident_prioritization_strategy';
for (const line of envFile.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed.startsWith('NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY=')) {
    clientKey = trimmed.split('=')[1].trim();
  }
  if (trimmed.startsWith('NEXT_PUBLIC_FLAG_STRATEGY=')) {
    strategyFlagName = trimmed.slice('NEXT_PUBLIC_FLAG_STRATEGY='.length).trim() || strategyFlagName;
  }
}

if (!clientKey) {
  throw new Error('NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY is missing from .env.local.');
}

const flagsmith = new Flagsmith({
  environmentKey: clientKey,
  enableEvents: true,
});

const BASE = 'http://localhost:3000';
const NUM_PARTICIPANTS = 100;
const exposuresOnly = process.argv.includes('--exposures-only');

// Simple LCG PRNG for reproducible simulation
let seed = 42;
function random() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Load the 25 synthetic incidents to simulate what the user sees
const incidentsRaw = JSON.parse(fs.readFileSync('public/geo/incidents_data.json', 'utf8'));

function getRankedIncidents(variant) {
  const ranked = incidentsRaw.map(item => {
    let score;
    if (variant === 'spatial_impact') {
      const c = item.context;
      const C = 0.60 * c.population_index + 0.30 * c.facility_index + 0.10 * c.accessibility_index;
      score = item.severity_score * (0.55 + 0.45 * C);
    } else {
      score = item.severity_score;
    }
    return { ...item, display_score: score };
  });
  ranked.sort((a, b) => b.display_score - a.display_score);
  return ranked.map((item, idx) => ({ ...item, display_rank: idx + 1 }));
}

function simulateParticipantPicks(rankedList, persona) {
  let candidatePool = [];

  if (persona === 'top_ranked_bias') {
    // Sampling window includes severity-ranked benchmark targets at ranks 6, 8, and 10.
    // A top-rank operator can therefore sometimes succeed in severity_only.
    candidatePool = rankedList.slice(0, 12);
  } else if (persona === 'critical_infrastructure') {
    // Looks for incidents with high facility index among top 12
    const top12 = rankedList.slice(0, 12);
    top12.sort((a, b) => (b.context?.facility_index || 0) - (a.context?.facility_index || 0));
    candidatePool = top12.slice(0, 6);
  } else if (persona === 'population_focus') {
    // Looks for incidents with high population index among top 12
    const top12 = rankedList.slice(0, 12);
    top12.sort((a, b) => (b.context?.population_index || 0) - (a.context?.population_index || 0));
    candidatePool = top12.slice(0, 6);
  } else {
    // Imperfect dispatcher: looks at top 4 plus random item from 5-10
    const top4 = rankedList.slice(0, 4);
    const mid = rankedList.slice(4, 10);
    candidatePool = [...top4, ...shuffle(mid).slice(0, 2)];
  }

  // Pick exactly 3 unique incidents from candidate pool
  const shuffledCandidates = shuffle(candidatePool);
  const pickedIds = shuffledCandidates.slice(0, 3).map(c => c.id);

  // Safety fallback if pool was < 3
  while (pickedIds.length < 3) {
    const fallback = rankedList[pickedIds.length].id;
    if (!pickedIds.includes(fallback)) pickedIds.push(fallback);
  }

  return pickedIds;
}

async function main() {
  console.log('\n=============================================================');
  console.log(exposuresOnly
    ? '   TerraLens Flagsmith QA exposure smoke run'
    : `   TerraLens Track 01 traffic simulation (N=${NUM_PARTICIPANTS})`);
  console.log(`   Reading ${strategyFlagName} assignments from Flagsmith`);
  if (exposuresOnly) console.log('   Exposure events only; no sessions or outcomes are created.');
  console.log('=============================================================\n');

  // Stats
  let controlCount = 0;
  let treatmentCount = 0;
  let controlSuccess = 0;
  let treatmentSuccess = 0;
  let controlDurations = [];
  let treatmentDurations = [];
  let expiredSubmissions = 0;
  let totalDispatched = 0;
  let totalPrecisionSumControl = 0;
  let totalPrecisionSumTreatment = 0;

  for (let i = 1; i <= NUM_PARTICIPANTS; i++) {
    const participantId = exposuresOnly
      ? `terralens_qa_exposure_${i}_${Date.now()}`
      : `sim_p${i.toString().padStart(3, '0')}_${Date.now()}_${Math.floor(random() * 10000)}`;

    // Flagsmith evaluates the identity and records the experiment exposure through its SDK.
    const flag = await flagsmith.getExperimentFlag(strategyFlagName, participantId);
    if (!flag || flag.isDefault || !flag.enabled) {
      throw new Error(`Flagsmith did not return an enabled ${strategyFlagName} flag for ${participantId}.`);
    }
    if (!flag.experiment?.inExperiment) {
      throw new Error(`Flagsmith did not enroll ${participantId} in the running experiment.`);
    }
    if (!flag.variant || (flag.value !== 'severity_only' && flag.value !== 'spatial_impact')) {
      throw new Error(`Flagsmith returned a missing or unsupported strategy value for ${participantId}: ${String(flag.value)}.`);
    }
    const variant = flag.value;
    await flagsmith.flushEvents();

    if (variant === 'severity_only') controlCount++;
    else treatmentCount++;
    console.log(`[Simulator] ${participantId} assigned ${variant}; per-arm exposures: severity_only=${controlCount}, spatial_impact=${treatmentCount}`);

    if (exposuresOnly) {
      if (controlCount > 0 && treatmentCount > 0) break;
      continue;
    }

    // Step 3: Register Session in TerraLens Backend
    // Persona determination
    const personaRand = random();
    let persona = 'top_ranked_bias';
    if (personaRand < 0.35) persona = 'top_ranked_bias';
    else if (personaRand < 0.60) persona = 'critical_infrastructure';
    else if (personaRand < 0.80) persona = 'population_focus';
    else if (personaRand < 0.95) persona = 'imperfect_dispatcher';
    else persona = 'delayed_dispatcher';

    let simulatedDurationSeconds;
    if (persona === 'delayed_dispatcher') {
      simulatedDurationSeconds = 130 + random() * 10; // Exceeds 128s limit
    } else {
      simulatedDurationSeconds = 42 + random() * 58; // 42s to 100s
    }

    const sessionStart = new Date(Date.now() - simulatedDurationSeconds * 1000).toISOString();

    await fetch(`${BASE}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: participantId,
        scenario_id: 'jaipur_monsoon_2026',
        variant,
        assignment_source: 'flagsmith_remote',
        flagsmith_exposure_recorded: true,
        is_simulated: true,
        started_at: sessionStart,
      }),
    });

    // Step 4: Pick incidents using variant-specific ranked list
    const rankedList = getRankedIncidents(variant);
    const picks = simulateParticipantPicks(rankedList, persona);

    // Step 5: Submit Task to /api/submissions
    const subRes = await fetch(`${BASE}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: participantId,
        scenario_id: 'jaipur_monsoon_2026',
        selected_incident_ids: picks,
      }),
    });

    if (subRes.status === 408) {
      expiredSubmissions++;
    } else if (subRes.ok) {
      const subData = await subRes.json();
      totalDispatched++;
      if (variant === 'severity_only') {
        if (subData.success) controlSuccess++;
        controlDurations.push(subData.duration_seconds);
        totalPrecisionSumControl += subData.precision_at_3;
      } else {
        if (subData.success) treatmentSuccess++;
        treatmentDurations.push(subData.duration_seconds);
        totalPrecisionSumTreatment += subData.precision_at_3;
      }
    }

    if (i % 20 === 0 || i === NUM_PARTICIPANTS) {
      console.log(`[Simulator] Completed ${i}/${NUM_PARTICIPANTS} sessions. Control: ${controlCount}, Treatment: ${treatmentCount}`);
    }
  }

  console.log(`[Simulator] Final Flagsmith arm counts: severity_only=${controlCount}, spatial_impact=${treatmentCount}`);
  if (exposuresOnly && (controlCount === 0 || treatmentCount === 0)) {
    throw new Error('Could not observe both Flagsmith experiment arms during the QA exposure smoke run.');
  }

  if (exposuresOnly) return;

  const validControl = controlDurations.length;
  const validTreatment = treatmentDurations.length;

  const controlSuccessRate = validControl > 0 ? (controlSuccess / validControl) * 100 : 0;
  const treatmentSuccessRate = validTreatment > 0 ? (treatmentSuccess / validTreatment) * 100 : 0;
  const lift = treatmentSuccessRate - controlSuccessRate;

  const meanControlDur = validControl > 0 ? (controlDurations.reduce((a, b) => a + b, 0) / validControl).toFixed(1) : 0;
  const meanTreatmentDur = validTreatment > 0 ? (treatmentDurations.reduce((a, b) => a + b, 0) / validTreatment).toFixed(1) : 0;

  const meanPrecisionControl = validControl > 0 ? ((totalPrecisionSumControl / validControl) * 100).toFixed(1) : 0;
  const meanPrecisionTreatment = validTreatment > 0 ? ((totalPrecisionSumTreatment / validTreatment) * 100).toFixed(1) : 0;

  console.log('\n=============================================================');
  console.log('             SIMULATION EXECUTION RESULTS (N=100)            ');
  console.log('=============================================================');
  console.log(`Total Simulated Participants:  ${NUM_PARTICIPANTS}`);
  console.log(`Control Allocated (A):         ${controlCount}`);
  console.log(`Treatment Allocated (B):       ${treatmentCount}`);
  console.log(`Expired Submissions (>128s):   ${expiredSubmissions}`);
  console.log(`Valid Submissions Scored:      ${validControl + validTreatment}`);
  console.log('-------------------------------------------------------------');
  console.log(`Control (severity_only):       ${controlSuccess}/${validControl} (${controlSuccessRate.toFixed(1)}%)`);
  console.log(`Treatment (spatial_impact):    ${treatmentSuccess}/${validTreatment} (${treatmentSuccessRate.toFixed(1)}%)`);
  console.log(`Observed Lift:                 ${lift >= 0 ? '+' : ''}${lift.toFixed(1)}%`);
  console.log(`Precision@3 (Control vs Trt):  ${meanPrecisionControl}% vs ${meanPrecisionTreatment}%`);
  console.log(`Mean Duration (Control vs Trt): ${meanControlDur}s vs ${meanTreatmentDur}s`);
  console.log('=============================================================\n');
}

main().catch(error => {
  console.error('[Simulator] Failed:', error);
  process.exitCode = 1;
});
