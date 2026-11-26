import fs from 'node:fs';
import { createSeededRng, samplePlackettLucePicks, PLACKETT_LUCE_PARAMS } from './simulate_fair_plackett_luce.mjs';

const incidents = JSON.parse(fs.readFileSync('public/geo/incidents_data.json', 'utf8'));
const bmRaw = JSON.parse(fs.readFileSync('data/benchmarks_server_only.json', 'utf8'))
  .sort((a, b) => a.reference_rank - b.reference_rank);
const bmTop3 = bmRaw.slice(0, 3).map(b => b.incident_id);
const bmSet = new Set(bmTop3);

// 1. Control Ranking: Severity-only
const sevRanked = [...incidents].sort((a, b) => b.severity_score - a.severity_score);

// 2. Treatment Ranking: Spatial-impact
const spaRanked = [...incidents]
  .map(i => {
    const c = i.context;
    const C = 0.60 * c.population_index + 0.30 * c.facility_index + 0.10 * c.accessibility_index;
    return { ...i, s: i.severity_score * (0.55 + 0.45 * C) };
  })
  .sort((a, b) => b.s - a.s);

const N = 100000;
console.log(`Running N=${N} Monte Carlo simulations per arm with params:`, PLACKETT_LUCE_PARAMS);

function runSimulation(rankedList, name, seed) {
  const rng = createSeededRng(seed);
  let successCount = 0; // >= 2 hits
  let totalHits = 0;
  const hitDist = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const incidentSelectionFreq = {};
  for (const inc of incidents) {
    incidentSelectionFreq[inc.id] = 0;
  }

  for (let i = 0; i < N; i++) {
    const picks = samplePlackettLucePicks(rankedList, rng, PLACKETT_LUCE_PARAMS);
    let hits = 0;
    for (const p of picks) {
      incidentSelectionFreq[p]++;
      if (bmSet.has(p)) hits++;
    }
    hitDist[hits]++;
    totalHits += hits;
    if (hits >= 2) {
      successCount++;
    }
  }

  const pSuccess = successCount / N;
  const se = Math.sqrt((pSuccess * (1 - pSuccess)) / N);
  const ci95 = [pSuccess - 1.96 * se, pSuccess + 1.96 * se];
  const meanHits = totalHits / N;

  return {
    name,
    N,
    successCount,
    pSuccess,
    ci95,
    meanHits,
    hitDist,
    incidentSelectionFreq
  };
}

const sevRes = runSimulation(sevRanked, 'severity_only', 42);
const spaRes = runSimulation(spaRanked, 'spatial_impact', 999);

const diff = spaRes.pSuccess - sevRes.pSuccess;
const seDiff = Math.sqrt((sevRes.pSuccess * (1 - sevRes.pSuccess)) / N + (spaRes.pSuccess * (1 - spaRes.pSuccess)) / N);
const diffCi95 = [diff - 1.96 * seDiff, diff + 1.96 * seDiff];

const summary = {
  benchmark_top_3: bmTop3,
  control: {
    name: sevRes.name,
    p_success: sevRes.pSuccess,
    ci_95: sevRes.ci95,
    mean_hits: sevRes.meanHits,
    hit_distribution: sevRes.hitDist
  },
  treatment: {
    name: spaRes.name,
    p_success: spaRes.pSuccess,
    ci_95: spaRes.ci95,
    mean_hits: spaRes.meanHits,
    hit_distribution: spaRes.hitDist
  },
  absolute_difference: {
    diff,
    ci_95: diffCi95
  },
  control_selection_freq: sevRes.incidentSelectionFreq,
  treatment_selection_freq: spaRes.incidentSelectionFreq
};

fs.writeFileSync('.data/mc_sim_100k_report.json', JSON.stringify(summary, null, 2));
console.log('Simulation complete! Summary:');
console.log(JSON.stringify({
  control_success: `${(sevRes.pSuccess * 100).toFixed(3)}% [${(sevRes.ci95[0]*100).toFixed(3)}%, ${(sevRes.ci95[1]*100).toFixed(3)}%]`,
  treatment_success: `${(spaRes.pSuccess * 100).toFixed(3)}% [${(spaRes.ci95[0]*100).toFixed(3)}%, ${(spaRes.ci95[1]*100).toFixed(3)}%]`,
  diff: `${(diff * 100).toFixed(3)} pp [${(diffCi95[0]*100).toFixed(3)} pp, ${(diffCi95[1]*100).toFixed(3)} pp]`,
  control_mean_hits: sevRes.meanHits.toFixed(4),
  treatment_mean_hits: spaRes.meanHits.toFixed(4)
}, null, 2));
