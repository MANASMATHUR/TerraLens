#!/usr/bin/env node

/**
 * Sends explicitly labelled scripted QA sessions to Flagsmith experiment 581.
 * Flagsmith assigns the arm and getExperimentFlag records its exposure. Task
 * outcomes are sent through the same app API used by the task page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Flagsmith } from '@flagsmith/nodejs';

const FLAG_NAME = process.env.NEXT_PUBLIC_FLAG_STRATEGY || 'incident_prioritization_strategy';
const ENVIRONMENT_KEY = process.env.FLAGSMITH_SERVER_KEY || process.env.NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY;
const EXPERIMENT_ID = Number(process.env.FLAGSMITH_EXPERIMENT_ID || 581);
const COHORT_LABEL = 'scripted QA operators, simulated';
const LEDGER_PATH = path.join(process.cwd(), '.data', 'track01-simulated-ledger.json');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targetIndex = args.indexOf('--target-per-arm');
const targetPerArm = dryRun ? 5 : targetIndex >= 0 ? Number(args[targetIndex + 1]) : NaN;
const baseUrlIndex = args.indexOf('--base-url');
const baseUrl = (baseUrlIndex >= 0 ? args[baseUrlIndex + 1] : 'http://localhost:3000').replace(/\/$/, '');
const VALID_ARMS = ['severity_only', 'spatial_impact'];

if (!ENVIRONMENT_KEY) throw new Error('Set FLAGSMITH_SERVER_KEY or NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY in .env.local.');
if (!Number.isInteger(EXPERIMENT_ID) || EXPERIMENT_ID !== 581) throw new Error('This scripted QA run is restricted to experiment 581.');
if (!dryRun && (targetIndex < 0 || !Number.isInteger(targetPerArm) || targetPerArm < 5)) {
  throw new Error('Use --dry-run for 5 per arm, or --target-per-arm N for a target of at least 5 per arm.');
}
if (dryRun && targetIndex >= 0) throw new Error('Choose either --dry-run or --target-per-arm, not both.');
if (baseUrlIndex >= 0 && !args[baseUrlIndex + 1]) throw new Error('--base-url requires an app URL.');

const target = dryRun ? 5 : targetPerArm;
const flagsmith = new Flagsmith({ environmentKey: ENVIRONMENT_KEY, enableEvents: true });

function loadLedger() {
  if (!fs.existsSync(LEDGER_PATH)) return { experiment_id: EXPERIMENT_ID, cohort: COHORT_LABEL, entries: [] };
  const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  if (ledger.experiment_id !== EXPERIMENT_ID || ledger.cohort !== COHORT_LABEL || !Array.isArray(ledger.entries)) {
    throw new Error(`Local simulator ledger is incompatible: ${LEDGER_PATH}`);
  }
  return ledger;
}

const ledger = loadLedger();
fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
function saveLedger() {
  fs.writeFileSync(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
}

function counts() {
  const result = Object.fromEntries(VALID_ARMS.map((arm) => [arm, { exposures: 0, submissions: 0, conversions: 0, success_conversions: 0, abandoned: 0 }]));
  for (const entry of ledger.entries) {
    if (!result[entry.arm]) continue;
    result[entry.arm].exposures += entry.exposure_recorded ? 1 : 0;
    result[entry.arm].submissions += entry.submission_recorded ? 1 : 0;
    result[entry.arm].conversions += entry.primary_conversion_recorded ? 1 : 0;
    result[entry.arm].success_conversions += entry.success_conversion_recorded ? 1 : 0;
    result[entry.arm].abandoned += entry.abandoned ? 1 : 0;
  }
  return result;
}

function report(label) {
  const totals = counts();
  console.log(`${label} — local simulator progress only; Flagsmith dashboard is the experiment result source.`);
  for (const arm of VALID_ARMS) {
    const row = totals[arm];
    console.log(`${arm}: exposures=${row.exposures}, submissions=${row.submissions}, primary_conversions=${row.conversions}, success_conversions=${row.success_conversions}, abandoned_expired=${row.abandoned}`);
  }
  const [control, treatment] = VALID_ARMS.map((arm) => totals[arm].exposures);
  const total = control + treatment;
  const imbalancePct = total ? Math.abs(control - treatment) / total * 100 : 0;
  if (imbalancePct > 10) throw new Error(`Arm imbalance ${imbalancePct.toFixed(1)}% exceeds 10%; stopping scripted traffic.`);
}

function validateFlag(flag, participantId, expectedArm) {
  if (!flag || flag.isDefault || !flag.enabled || !flag.experiment?.inExperiment) {
    throw new Error(`Flagsmith did not enroll ${participantId} in experiment ${EXPERIMENT_ID} on ${FLAG_NAME}.`);
  }
  if (!VALID_ARMS.includes(flag.value)) {
    throw new Error(`Flagsmith returned a missing or unsupported ${FLAG_NAME} value for ${participantId}: ${String(flag.value)}.`);
  }
  if (Number(flag.experiment.id) !== EXPERIMENT_ID) {
    throw new Error(`Flagsmith returned experiment ${String(flag.experiment.id)} for ${participantId}; expected ${EXPERIMENT_ID}.`);
  }
  if (expectedArm && flag.value !== expectedArm) {
    throw new Error(`Flagsmith assignment changed for ${participantId}: preflight=${expectedArm}, getExperimentFlag=${flag.value}.`);
  }
  return flag.value;
}

async function assignedArmWithoutExposure(participantId) {
  const flags = await flagsmith.getIdentityFlags(participantId);
  const flag = flags.flags[FLAG_NAME];
  return validateFlag(flag, participantId);
}

async function buildBalancedBatch(countPerArm) {
  const candidates = { severity_only: [], spatial_impact: [] };
  let attempts = 0;
  while (VALID_ARMS.some((arm) => candidates[arm].length < countPerArm)) {
    attempts += 1;
    if (attempts > 2000) throw new Error('Could not find enough Flagsmith-assigned identities for both arms after 2000 candidates.');
    const participantId = `qa_sim_${randomUUID()}`;
    const arm = await assignedArmWithoutExposure(participantId);
    if (candidates[arm].length < countPerArm) candidates[arm].push({ participantId, expectedArm: arm });
  }

  const batch = [];
  for (let i = 0; i < countPerArm; i++) {
    batch.push(candidates.severity_only[i], candidates.spatial_impact[i]);
  }
  return batch;
}

function rngFor(seed) {
  let state = 2166136261;
  for (const character of seed) state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffle(values, random) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const PERSONAS = [
  ['top_ranked_bias', 35],
  ['critical_infrastructure', 25],
  ['population_focus', 20],
  ['imperfect_dispatcher', 15],
  ['delayed_dispatcher', 5],
];

function choosePersona(random) {
  let draw = random() * 100;
  for (const [name, weight] of PERSONAS) {
    draw -= weight;
    if (draw < 0) return name;
  }
  return 'delayed_dispatcher';
}

function chooseIncidents(incidents, config, arm, participantId) {
  const random = rngFor(participantId);
  const ranked = incidents.map((incident) => {
    const context = incident.context || {};
    const consequence = Number(config.population_weight || 0) * Number(context.population_index || 0)
      + Number(config.facility_weight || 0) * Number(context.facility_index || 0)
      + Number(config.accessibility_weight || 0) * Number(context.accessibility_index || 0);
    const score = arm === 'severity_only'
      ? Number(incident.severity_score)
      : Number(incident.severity_score) * ((1 - Number(config.mix_factor)) + Number(config.mix_factor) * consequence);
    return { incident, score };
  }).sort((a, b) => b.score - a.score).map(({ incident }) => incident);
  if (ranked.length !== 25) throw new Error(`Expected all 25 synthetic incidents; received ${ranked.length}.`);

  const persona = choosePersona(random);
  const top12 = ranked.slice(0, 12);
  let pool;
  if (persona === 'critical_infrastructure') {
    pool = [...top12].sort((a, b) => Number(b.context?.facility_index || 0) - Number(a.context?.facility_index || 0)).slice(0, 6);
  } else if (persona === 'population_focus') {
    pool = [...top12].sort((a, b) => Number(b.context?.population_index || 0) - Number(a.context?.population_index || 0)).slice(0, 6);
  } else if (persona === 'imperfect_dispatcher' || persona === 'delayed_dispatcher') {
    pool = [...ranked.slice(0, 4), ...shuffle(ranked.slice(4, 10), random).slice(0, 2)];
  } else {
    pool = top12;
  }

  const selected = shuffle(pool, random).slice(0, 3).map((incident) => Number(incident.id));
  if (selected.length !== 3 || new Set(selected).size !== 3 || selected.some((id) => !Number.isInteger(id) || id < 1 || id > 25)) {
    throw new Error(`Persona ${persona} did not produce exactly three valid incident IDs.`);
  }
  const decisionMs = persona === 'delayed_dispatcher'
    ? 5000 + Math.floor(random() * 4000)
    : 1000 + Math.floor(random() * 3000);
  return { persona, selected, decisionMs };
}

async function postJson(route, payload) {
  const url = `${baseUrl}${route}`;
  let response;
  let responseText;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    responseText = await response.text();
  } catch (error) {
    throw new Error(`Request failed before receiving a response.\nRequest: POST ${url}\nBody: ${JSON.stringify(payload)}\nError: ${String(error)}`);
  }
  if (!response.ok) {
    throw new Error(`Request failed.\nRequest: POST ${url}\nBody: ${JSON.stringify(payload)}\nResponse: HTTP ${response.status} ${response.statusText}\n${responseText}`);
  }
  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error(`Response was not JSON.\nRequest: POST ${url}\nBody: ${JSON.stringify(payload)}\nResponse: HTTP ${response.status}\n${responseText}`);
  }
}

const nowAtStart = Date.now();
for (const entry of ledger.entries) {
  if (!entry.exposure_recorded || entry.submission_recorded || entry.abandoned) continue;
  const startedAt = Date.parse(entry.session_started_at || entry.created_at || '');
  if (!Number.isFinite(startedAt)) {
    throw new Error(`Cannot determine session age for incomplete exposure ${entry.participantId}; refusing to retry it.`);
  }
  if (nowAtStart - startedAt > 128_000) {
    entry.abandoned = true;
    entry.abandoned_reason = 'session_window_expired';
    entry.abandoned_at = new Date(nowAtStart).toISOString();
  } else {
    throw new Error(`Incomplete session ${entry.participantId} is still within its acceptance window; refusing to replay it blindly.`);
  }
}
saveLedger();
const totalsAfterReconciliation = counts();
for (const arm of VALID_ARMS) {
  if (totalsAfterReconciliation[arm].exposures > target) throw new Error(`Local ledger already has ${totalsAfterReconciliation[arm].exposures} ${arm} exposures, above requested target ${target}.`);
  if (totalsAfterReconciliation[arm].exposures !== totalsAfterReconciliation[arm].submissions + totalsAfterReconciliation[arm].abandoned) {
    throw new Error(`Ledger has incomplete sessions for ${arm}; reconcile the previous batch before starting another run.`);
  }
}
if (totalsAfterReconciliation.severity_only.exposures !== totalsAfterReconciliation.spatial_impact.exposures) {
  throw new Error('Ledger arm counts are uneven; reconcile the previous batch before starting another run.');
}

console.log(`Starting ${COHORT_LABEL} traffic for Flagsmith experiment ${EXPERIMENT_ID} (${FLAG_NAME}); target=${target} per arm.`);
console.log(`App endpoint: ${baseUrl}. IDs are prefixed qa_sim_ and stored with is_simulated=true.`);

try {
  const incidentsResponse = await fetch(`${baseUrl}/api/incidents`, { cache: 'no-store' });
  if (!incidentsResponse.ok) throw new Error(`GET ${baseUrl}/api/incidents returned HTTP ${incidentsResponse.status}.`);
  const incidents = await incidentsResponse.json();
  if (!Array.isArray(incidents) || incidents.length !== 25) throw new Error('GET /api/incidents did not return all 25 incidents.');

  let batchNumber = 0;
  while (counts().severity_only.exposures < target) {
    const neededPerArm = Math.min(5, target - counts().severity_only.exposures);
    if (neededPerArm !== Math.min(5, target - counts().spatial_impact.exposures)) {
      throw new Error('Current arm counts do not permit a balanced ten-session batch.');
    }
    batchNumber += 1;
    const batch = await buildBalancedBatch(neededPerArm);

    for (const person of batch) {
      const flag = await flagsmith.getExperimentFlag(FLAG_NAME, person.participantId);
      person.arm = validateFlag(flag, person.participantId, person.expectedArm);
      person.exposure_recorded = true;
      person.submission_recorded = false;
      person.primary_conversion_recorded = false;
      person.success_conversion_recorded = false;
      person.is_simulated = true;
      person.cohort = COHORT_LABEL;
      person.created_at = new Date().toISOString();
      ledger.entries.push(person);
      saveLedger();
    }
    await flagsmith.flushEvents();

    const sessions = await Promise.all(batch.map(async (person) => {
      const session = await postJson('/api/sessions', {
        participant_id: person.participantId,
        variant: person.arm,
        assignment_source: 'flagsmith_remote',
        flagsmith_exposure_recorded: true,
        is_simulated: true,
      });
      if (!session.is_simulated || session.variant !== person.arm || session.participant_id !== person.participantId) {
        throw new Error(`Session response did not preserve Flagsmith arm and simulated identity for ${person.participantId}: ${JSON.stringify(session)}`);
      }
      return { person, session };
    }));

    const submissionResults = await Promise.allSettled(sessions.map(async ({ person, session }) => {
      const decision = chooseIncidents(incidents, session.model_config, person.arm, person.participantId);
      person.persona = decision.persona;
      person.selected_incident_ids = decision.selected;
      person.decision_ms = decision.decisionMs;
      await new Promise((resolve) => setTimeout(resolve, decision.decisionMs));
      const result = await postJson('/api/submissions', {
        participant_id: person.participantId,
        selected_incident_ids: decision.selected,
        model_config: session.model_config,
        model_config_signature: session.model_config_signature,
      });
      if (typeof result.flagsmith_events?.submitted !== 'boolean') {
        throw new Error(`Submission response omitted flagsmith_events.submitted for ${person.participantId}: ${JSON.stringify(result)}`);
      }
      person.submission_recorded = true;
      person.primary_conversion_recorded = result.flagsmith_events.submitted;
      person.success_conversion_recorded = result.flagsmith_events.success === true;
      person.successful = result.success === true;
      person.consequence_capture = result.consequence_metrics?.consequence_capture;
      person.completed_at = new Date().toISOString();
      saveLedger();
      console.log(`${person.participantId} [${COHORT_LABEL}] arm=${person.arm}, persona=${person.persona}, selected=${person.selected_incident_ids.join(',')}, successful=${person.successful}, primary_conversion=${person.primary_conversion_recorded}, consequence_capture=${person.consequence_capture}`);
    }));

    const submissionErrors = submissionResults.filter((result) => result.status === 'rejected');

    const totals = counts();
    console.log(`Batch ${batchNumber}: severity_only exposures=${totals.severity_only.exposures}, submissions=${totals.severity_only.submissions}, primary_conversions=${totals.severity_only.conversions}, success_conversions=${totals.severity_only.success_conversions}; spatial_impact exposures=${totals.spatial_impact.exposures}, submissions=${totals.spatial_impact.submissions}, primary_conversions=${totals.spatial_impact.conversions}, success_conversions=${totals.spatial_impact.success_conversions}.`);
    report('Batch complete');
    if (submissionErrors.length) {
      for (const failure of submissionErrors) console.error(`Submission failure: ${failure.reason instanceof Error ? failure.reason.message : String(failure.reason)}`);
      throw new Error(`${submissionErrors.length} of ${sessions.length} submissions failed after all batch requests settled.`);
    }
  }

  const finalCounts = counts();
  if (finalCounts.severity_only.exposures !== target || finalCounts.spatial_impact.exposures !== target) {
    throw new Error(`Run stopped at unexpected arm counts: ${JSON.stringify(finalCounts)}.`);
  }
  if (dryRun && (finalCounts.severity_only.conversions + finalCounts.spatial_impact.conversions) === 0) {
    throw new Error('Dry run recorded zero primary conversion events; stop before the full run.');
  }
  console.log(`${dryRun ? 'Dry run' : 'Full run'} complete for ${COHORT_LABEL}.`);
  report('Final');
} finally {
  await flagsmith.close();
}
