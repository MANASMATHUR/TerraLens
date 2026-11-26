/**
 * Offline synthetic scenario projection for Track 01.
 * This script never calls Flagsmith, the app API, or the session store.
 * Its output is a model projection, not participant or experiment data.
 */
import fs from 'node:fs';

const incidents = JSON.parse(fs.readFileSync('public/geo/incidents_data.json', 'utf8'));
const benchmark = JSON.parse(fs.readFileSync('data/benchmarks_server_only.json', 'utf8'))
  .sort((a, b) => a.reference_rank - b.reference_rank)
  .slice(0, 3)
  .map((row) => row.incident_id);
const benchmarkSet = new Set(benchmark);
const benchmarkMeanConsequence = benchmark.reduce((sum, id) => {
  const incident = incidents.find((row) => row.id === id);
  return sum + Number(incident?.context?.composite_c ?? 0);
}, 0) / benchmark.length;

const ITERATIONS = 200000;
const TOP_RANKED_WINDOW = 12;
const FLAGSMITH_MIN_IDENTITIES_PER_ARM = 50;
const PERSONA_MIXES = [
  {
    name: 'baseline_mixed_operators',
    weights: { top_ranked_bias: 35, critical_infrastructure: 25, population_focus: 20, imperfect_dispatcher: 15, delayed_dispatcher: 5 },
  },
  {
    name: 'severity_first_sensitivity',
    weights: { top_ranked_bias: 60, critical_infrastructure: 15, population_focus: 5, imperfect_dispatcher: 15, delayed_dispatcher: 5 },
  },
];

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffle(values, random) {
  const shuffled = [...values];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function pickThree(pool, random) {
  return shuffle(pool, random).slice(0, 3);
}

function rankedRows(variant) {
  const scored = incidents.map((incident) => {
    if (variant === 'severity_only') return { ...incident, display_score: incident.severity_score };
    const context = incident.context;
    const consequence = 0.60 * context.population_index + 0.30 * context.facility_index + 0.10 * context.accessibility_index;
    return { ...incident, display_score: incident.severity_score * (0.55 + 0.45 * consequence) };
  }).sort((a, b) => b.display_score - a.display_score);
  if (scored.length !== incidents.length) throw new Error('A ranking arm omitted incidents from the shared 25-incident set.');
  return scored;
}

const ranked = {
  severity_only: rankedRows('severity_only'),
  spatial_impact: rankedRows('spatial_impact'),
};

function personaPool(rows, persona, random) {
  if (persona === 'top_ranked_bias') return rows.slice(0, TOP_RANKED_WINDOW);
  if (persona === 'critical_infrastructure') {
    return [...rows.slice(0, TOP_RANKED_WINDOW)]
      .sort((a, b) => (b.context?.facility_index ?? 0) - (a.context?.facility_index ?? 0))
      .slice(0, 6);
  }
  if (persona === 'population_focus') {
    return [...rows.slice(0, TOP_RANKED_WINDOW)]
      .sort((a, b) => (b.context?.population_index ?? 0) - (a.context?.population_index ?? 0))
      .slice(0, 6);
  }
  const midRanks = shuffle(rows.slice(4, 10), random).slice(0, 2);
  return [...rows.slice(0, 4), ...midRanks];
}

function drawPersona(weights, random) {
  let draw = random() * 100;
  for (const [persona, weight] of Object.entries(weights)) {
    draw -= weight;
    if (draw <= 0) return persona;
  }
  return Object.keys(weights).at(-1);
}

function consequenceCapture(picks) {
  const mean = picks.reduce((sum, incident) => sum + Number(incident.context.composite_c), 0) / picks.length;
  return Math.max(0, Math.min(1, mean / benchmarkMeanConsequence));
}

function summarize(values) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return { mean, standard_deviation: Math.sqrt(variance) };
}

function requiredValidN(effect, pooledSd) {
  if (!(effect > 0)) return null;
  const zAlphaTwoSided = 1.959964;
  const zPower80 = 0.841621;
  return Math.ceil(2 * ((zAlphaTwoSided + zPower80) ** 2) * (pooledSd ** 2) / (effect ** 2));
}

function runProjection(mix, seed) {
  const random = createRng(seed);
  const outcomes = { severity_only: [], spatial_impact: [] };
  const successes = { severity_only: 0, spatial_impact: 0 };
  let validPeople = 0;
  let delayedPeople = 0;

  for (let i = 0; i < ITERATIONS; i++) {
    const persona = drawPersona(mix.weights, random);
    if (persona === 'delayed_dispatcher') {
      delayedPeople++;
      continue;
    }
    validPeople++;
    for (const arm of ['severity_only', 'spatial_impact']) {
      const pool = personaPool(ranked[arm], persona, random);
      const picks = pickThree(pool, random);
      outcomes[arm].push(consequenceCapture(picks));
      if (picks.filter((incident) => benchmarkSet.has(incident.id)).length >= 2) successes[arm]++;
    }
  }

  const control = summarize(outcomes.severity_only);
  const treatment = summarize(outcomes.spatial_impact);
  const effect = treatment.mean - control.mean;
  const pooledSd = Math.sqrt((control.standard_deviation ** 2 + treatment.standard_deviation ** 2) / 2);
  const modelRequiredValidN = requiredValidN(Math.abs(effect), pooledSd);
  const delayedShare = delayedPeople / ITERATIONS;
  const plannedValidN = modelRequiredValidN === null
    ? null
    : Math.max(modelRequiredValidN, FLAGSMITH_MIN_IDENTITIES_PER_ARM);
  const exposuresPerArm = plannedValidN === null ? null : Math.ceil(plannedValidN / (1 - delayedShare));
  const benchmarkSuccessRates = {
    severity_only: successes.severity_only / validPeople,
    spatial_impact: successes.spatial_impact / validPeople,
  };

  return {
    persona_mix_percent: mix.weights,
    simulated_operator_draws_per_arm: validPeople,
    projected_mean_consequence_capture: {
      severity_only: Number(control.mean.toFixed(4)),
      spatial_impact: Number(treatment.mean.toFixed(4)),
      absolute_difference: Number(effect.toFixed(4)),
      relative_difference_percent: control.mean ? Number((effect / control.mean * 100).toFixed(2)) : null,
      pooled_standard_deviation: Number(pooledSd.toFixed(4)),
      cohens_d: pooledSd ? Number((effect / pooledSd).toFixed(3)) : null,
    },
    projected_benchmark_success_rate: {
      severity_only: Number(benchmarkSuccessRates.severity_only.toFixed(4)),
      spatial_impact: Number(benchmarkSuccessRates.spatial_impact.toFixed(4)),
    },
    sample_size_projection: {
      method: 'two-sided two-sample means approximation; alpha 0.05; power 0.80; outcome SD from this offline simulation',
      model_formula_valid_submissions_per_arm: modelRequiredValidN,
      Flagsmith_minimum_identities_per_arm: FLAGSMITH_MIN_IDENTITIES_PER_ARM,
      planned_valid_submissions_per_arm: plannedValidN,
      enrolled_people_per_arm_after_delayed_dispatchers: exposuresPerArm,
      delayed_persona_share: Number(delayedShare.toFixed(4)),
    },
  };
}

const severityRank = new Map(ranked.severity_only.map((incident, index) => [incident.id, index + 1]));

const baseline = runProjection(PERSONA_MIXES[0], 20261126);
const sensitivity = runProjection(PERSONA_MIXES[1], 20261127);
console.log(JSON.stringify({
  label: 'OFFLINE SYNTHETIC PROJECTION — not Flagsmith results or observed participants',
  benchmark_top3: benchmark,
  incident_pool: {
    total: incidents.length,
    all_incidents_retained_in_both_rankings: true,
    excluded_incident_ids: [],
  },
  sampling_window: {
    top_ranked_bias_uses_top_n: TOP_RANKED_WINDOW,
    severity_only_benchmark_target_ranks: benchmark.map((id) => severityRank.get(id)),
    reason: 'The control targets at severity ranks 6, 8, and 10; a top-12 window lets severity_only sometimes select two benchmark targets.',
  },
  repetitions_per_persona_mix: ITERATIONS,
  scenarios: [
    { name: PERSONA_MIXES[0].name, ...baseline },
    { name: PERSONA_MIXES[1].name, ...sensitivity },
  ],
  traffic_sent_to_flagsmith: false,
}, null, 2));
