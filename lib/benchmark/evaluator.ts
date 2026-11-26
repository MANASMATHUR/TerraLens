/**
 * Server-only evaluation engine.
 * Compares participant selections against the independent physical disruption benchmark.
 * Note: Participant task is an UNORDERED selection of 3 incidents.
 * Metrics:
 * - successful: boolean (matches >= 2)
 * - matches: count of hits in top-3 ground truth
 * - precision_at_3: matches / 3
 * - recall_at_3: matches / 3 (since benchmark top-3 size is exactly 3)
 */
export interface EvaluationResult {
  successful: boolean;
  matches: number;
  precision_at_3: number;
}

export function evaluateSubmission(
  selectedIds: number[],
  benchmarkTop3Ids: number[],
  requiredMatches = 2
): EvaluationResult {
  // Count matches in the top-3 benchmark set
  const matchSet = new Set(benchmarkTop3Ids);
  const matchingPicks = selectedIds.filter((id) => matchSet.has(id));
  const matches = matchingPicks.length;

  // Primary success condition: at least 2 of 3 match top-3 benchmark
  const successful = matches >= requiredMatches;

  // For unordered selection of size 3 from target of size 3:
  // Precision@3 = matches / 3
  const precision_at_3 = Number((matches / 3).toFixed(4));

  return {
    successful,
    matches,
    precision_at_3,
  };
}
