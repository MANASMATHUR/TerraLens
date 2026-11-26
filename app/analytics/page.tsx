'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from '@/components/layout/Header';
import { METRIC_DEFINITIONS } from '@/lib/flagsmith/metrics';

type ResultVariant = {
  variant: string;
  evaluations: number;
  conversions: number;
  conversion_rate: number;
};

type ExperimentResults = {
  feature: string;
  variants: ResultVariant[];
  statistics: {
    p_value: number;
    significant: boolean;
    chance_to_win: Record<string, number>;
    lift: string;
    winner: string | null;
    recommendation: string;
    sample_size_warning: string | null;
  };
};

type ExposureSnapshot = {
  as_of?: string;
  payload?: {
    timeseries?: {
      points?: Array<{ new_identities?: Record<string, number> }>;
    };
    excluded_identities?: number;
  };
  is_final?: boolean;
};

type FeatureOption = { id: number; key: string; string_value: string | null };
type RolloutAllocation = { multivariate_feature_option: number; percentage_allocation: number };
type ExperimentSnapshot = {
  status?: string;
  feature?: { name?: string; initial_value?: string | null; multivariate_options?: FeatureOption[] };
  experiment_rollout?: {
    rollout_percentage?: number;
    multivariate_feature_state_values?: RolloutAllocation[];
  };
};

type Snapshot = {
  source?: string;
  api_answered?: boolean;
  experiment_id?: string;
  dashboard_url?: string;
  result_state?: 'error' | 'invalid_payload' | 'not_computed' | 'computed';
  result?: ExperimentResults | null;
  exposures?: ExposureSnapshot | null;
  experiment?: ExperimentSnapshot | null;
  errors?: Record<string, string> | null;
  error?: string;
};

function getExposureCounts(exposureSnapshot: ExposureSnapshot | null | undefined): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const point of exposureSnapshot?.payload?.timeseries?.points ?? []) {
    for (const [variant, count] of Object.entries(point.new_identities ?? {})) {
      if (Number.isFinite(count)) counts[variant] = (counts[variant] ?? 0) + count;
    }
  }
  return counts;
}

function getArms(experiment: ExperimentSnapshot | null | undefined) {
  const feature = experiment?.feature;
  const allocations = experiment?.experiment_rollout?.multivariate_feature_state_values ?? [];
  const options = feature?.multivariate_options ?? [];
  const treatmentTotal = allocations.reduce((total, arm) => total + arm.percentage_allocation, 0);
  return [
    { key: 'control', value: feature?.initial_value ?? 'control', allocation: Math.max(0, 100 - treatmentTotal) },
    ...allocations.map((arm) => {
      const option = options.find((candidate) => candidate.id === arm.multivariate_feature_option);
      return {
        key: option?.key ?? `variation_${arm.multivariate_feature_option}`,
        value: option?.string_value ?? 'unknown',
        allocation: arm.percentage_allocation,
      };
    }),
  ];
}

function armLabel(key: string, experiment: ExperimentSnapshot | null | undefined): string {
  const arm = getArms(experiment).find((candidate) => candidate.key === key);
  return arm ? `${arm.key} · ${arm.value}` : key;
}

function formatChance(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const percent = value >= 0 && value <= 1 ? value * 100 : value;
  return `${percent.toFixed(1)}%`;
}

// Flagsmith documents the SRM warning threshold as p < 0.001 after 100 identities.
function erfc(value: number): number {
  const x = Math.abs(value);
  const t = 1 / (1 + 0.5 * x);
  const polynomial = 1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))));
  const approximation = t * Math.exp(-x * x - 1.26551223 + t * polynomial);
  return value >= 0 ? approximation : 2 - approximation;
}

function splitHealth(counts: Record<string, number>, experiment: ExperimentSnapshot | null | undefined) {
  const arms = getArms(experiment);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const configuredTotal = arms.reduce((sum, arm) => sum + arm.allocation, 0);
  const details = arms.map((arm) => ({
    ...arm,
    exposures: counts[arm.key] ?? 0,
    observedShare: total ? (counts[arm.key] ?? 0) / total * 100 : null,
    expectedShare: configuredTotal ? arm.allocation / configuredTotal * 100 : null,
  }));

  if (total < 100 || arms.length !== 2 || configuredTotal <= 0) {
    return { total, details, status: 'Not assessed yet: Flagsmith checks SRM after 100 identities.', pValue: null as number | null };
  }

  const chiSquare = details.reduce((sum, arm) => {
    const expected = total * arm.allocation / configuredTotal;
    return expected > 0 ? sum + ((arm.exposures - expected) ** 2) / expected : sum;
  }, 0);
  const pValue = erfc(Math.sqrt(chiSquare / 2));
  return {
    total,
    details,
    status: pValue < 0.001 ? 'Sample ratio mismatch detected (p < 0.001).' : 'No sample ratio mismatch detected (p ≥ 0.001).',
    pValue,
  };
}

function verdictFor(result: ExperimentResults | null | undefined): 'winning' | 'losing' | 'inconclusive' {
  if (!result || !Array.isArray(result.variants)) return 'inconclusive';
  const treatment = result.variants.find((variant) => variant.variant !== 'control');
  if (!treatment) return 'inconclusive';
  const chance = result.statistics?.chance_to_win?.[treatment.variant];
  if (typeof chance !== 'number' || !Number.isFinite(chance)) return 'inconclusive';
  const probability = chance > 1 ? chance / 100 : chance;
  if (probability >= 0.95) return 'winning';
  if (probability <= 0.05) return 'losing';
  return 'inconclusive';
}

export default function AnalyticsPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/analytics', { cache: 'no-store' });
      setSnapshot(await response.json() as Snapshot);
    } catch (error) {
      setSnapshot({ source: 'flagsmith_management_api', api_answered: false, error: String(error) });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => getExposureCounts(snapshot?.exposures), [snapshot?.exposures]);
  const split = useMemo(() => splitHealth(counts, snapshot?.experiment), [counts, snapshot?.experiment]);
  const result = snapshot?.result ?? null;
  const verdict = verdictFor(result);

  return <div className="min-h-screen bg-slate-50 text-slate-900"><Header />
    <main className="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-sky-700">Flagsmith Experiment Results</p>
        <h1 className="text-3xl font-semibold">Incident prioritization</h1>
        <p className="text-sm text-slate-600">Hypothesis: adding spatial consequence to incident ranking increases operators’ mean consequence capture compared with severity-only ranking.</p>
      </header>

      <section className="space-y-4 rounded border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Flagsmith results snapshot</h2>
          <button onClick={() => void load()} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Refresh from Flagsmith</button>
        </div>
        {loading ? <p className="text-sm text-slate-500">Requesting Flagsmith experiment data…</p> : <>
          <p className="text-sm">Flagsmith API answered: <strong>{snapshot?.api_answered ? 'yes' : 'no'}</strong>{snapshot?.experiment_id ? ` · Experiment ${snapshot.experiment_id}` : ''}</p>
          {snapshot?.dashboard_url && <a className="text-sm font-medium text-sky-700 underline" href={snapshot.dashboard_url} target="_blank" rel="noreferrer">Open experiment in Flagsmith</a>}
          {snapshot?.error && <p role="alert" className="break-words rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Flagsmith request failed: {snapshot.error}</p>}
          {snapshot?.errors && <p role="alert" className="break-words rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Some Flagsmith endpoints did not answer: {JSON.stringify(snapshot.errors)}</p>}

          {result ? <>
            <div className="rounded border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Generated verdict</p>
              <p className="mt-1 text-xl font-semibold">{verdict}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead><tr className="border-b text-slate-500"><th className="py-2">Arm</th><th>Exposures</th><th>Conversions</th><th>conversion_rate</th><th>Chance to beat control</th></tr></thead>
                <tbody>{result.variants.map((variant) => <tr key={variant.variant} className="border-b last:border-0">
                  <td className="py-3 font-medium">{armLabel(variant.variant, snapshot?.experiment)}</td>
                  <td>{variant.evaluations}</td><td>{variant.conversions}</td><td>{variant.conversion_rate}</td>
                  <td>{formatChance(result.statistics?.chance_to_win?.[variant.variant])}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">lift and interval as Flagsmith reports it</p><p className="mt-1 break-words font-medium">{result.statistics.lift}</p></div>
              <div className="rounded bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Winner</p><p className="mt-1 font-medium">{result.statistics.winner ?? '—'}</p></div>
              <div className="rounded bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Recommendation</p><p className="mt-1 break-words font-medium">{result.statistics.recommendation}</p></div>
              <div className="rounded bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Sample size warning</p><p className="mt-1 break-words font-medium">{result.statistics.sample_size_warning ?? 'None reported'}</p></div>
            </div>
          </> : <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-medium">{snapshot?.result_state === 'not_computed'
              ? `Flagsmith has not computed a result yet: ${split.total} exposures, — conversions (the exposure response does not report conversions).`
              : snapshot?.result_state === 'invalid_payload'
                ? 'Flagsmith answered, but the response did not match the documented ExperimentResults fields.'
                : 'Flagsmith did not answer the results request; no local or SQLite result is shown.'}</p>
            {snapshot?.result_state === 'not_computed' && <p className="mt-1">A conversion count is shown only when the Flagsmith results payload includes it.</p>}
          </div>}

          <div className="space-y-2 rounded border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">Split health from Flagsmith exposures</h3><span className="text-xs text-slate-500">{split.total} total identities</span></div>
            <p className="text-sm">{split.status}{split.pValue !== null ? ` SRM p-value: ${split.pValue.toPrecision(3)}.` : ''}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {split.details.map((arm) => <p key={arm.key} className="rounded bg-slate-50 p-3 text-sm">
                <strong>{armLabel(arm.key, snapshot?.experiment)}</strong>: {arm.exposures} exposures · observed {arm.observedShare === null ? '—' : `${arm.observedShare.toFixed(1)}%`} · configured {arm.expectedShare === null ? '—' : `${arm.expectedShare.toFixed(1)}%`}
              </p>)}
            </div>
            {snapshot?.exposures?.as_of && <p className="text-xs text-slate-500">Exposure snapshot as of {new Date(snapshot.exposures.as_of).toLocaleString()}.</p>}
          </div>
          {result && <details><summary className="cursor-pointer text-sm font-medium">Raw Flagsmith results payload</summary><pre className="mt-3 max-h-[32rem] overflow-auto rounded bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(result, null, 2)}</pre></details>}
        </>}
      </section>

      <section className="rounded border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">Configured experiment metrics</h2>
        <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-2">Name</th><th>Aggregation</th><th>Direction</th><th>Event name</th></tr></thead><tbody>{METRIC_DEFINITIONS.map((metric) => <tr key={metric.name} className="border-b last:border-0"><td className="py-3 font-mono">{metric.name}</td><td>{metric.aggregation}</td><td>{metric.direction}</td><td className="font-mono">{metric.event}<span className="block font-sans text-xs text-slate-500">{metric.value}</span></td></tr>)}</tbody></table></div>
      </section>
      <p className="text-xs text-slate-500">The Flagsmith Management API is the only experiment-results source. No SQLite values or locally calculated credible intervals are presented.</p>
    </main>
  </div>;
}
