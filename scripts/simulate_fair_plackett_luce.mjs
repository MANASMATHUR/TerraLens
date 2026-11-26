/**
 * Pre-registered Fair Plackett-Luce Stochastic Selection Model
 *
 * Designed to eliminate the Experiment 468 simulator floor effect.
 * Every incident in the 25-item ranked list has a non-zero selection probability:
 *   w_r = exp(-lambda * (r - 1)) + epsilon
 * where r is the 1-based display rank, lambda = 0.18 (rank decay), epsilon = 0.02 (exploration floor).
 *
 * Identical parameters are used for both Control (severity_only) and Treatment (spatial_impact).
 * Does NOT access benchmark labels or scores.
 */

export const PLACKETT_LUCE_PARAMS = {
  lambda: 0.18,
  epsilon: 0.02,
  picks: 3,
};

export function createSeededRng(seed = 2026) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function samplePlackettLucePicks(rankedList, rng = Math.random, params = PLACKETT_LUCE_PARAMS) {
  const remaining = rankedList.map((item, idx) => ({
    id: item.id,
    weight: Math.exp(-params.lambda * idx) + params.epsilon,
  }));

  const selected = [];
  for (let k = 0; k < params.picks && remaining.length > 0; k++) {
    const totalWeight = remaining.reduce((sum, item) => sum + item.weight, 0);
    let r = rng() * totalWeight;
    let chosenIdx = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      r -= remaining[i].weight;
      if (r <= 0) {
        chosenIdx = i;
        break;
      }
    }
    selected.push(remaining[chosenIdx].id);
    remaining.splice(chosenIdx, 1);
  }

  return selected;
}
