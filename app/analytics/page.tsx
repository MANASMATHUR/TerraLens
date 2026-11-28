'use client';

import { useCallback, useEffect, useState } from 'react';
import Header from '@/components/layout/Header';

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
    p_value?: number;
    significant?: boolean;
    chance_to_win: Record<string, number>;
    lift: string;
    winner: string | null;
    recommendation: string;
    sample_size_warning: string | null;
  };
  raw_metrics?: Array<{
    metric_id?: number;
    inference?: Record<string, { lift?: number; ci_low?: number; ci_high?: number; chance_to_win?: number } | null>;
  }>;
};

type ExposureSnapshot = {
  as_of?: string;
  payload?: {
    timeseries?: { points?: Array<{ new_identities?: Record<string, number> }> };
    excluded_identities?: number;
  };
  is_final?: boolean;
};

type FeatureOption = { id: number; key: string; string_value: string | null };
type RolloutAllocation = { multivariate_feature_option: number; percentage_allocation: number };
type ExperimentSnapshot = {
  status?: string;
  feature?: { name?: string; initial_value?: string | null; multivariate_options?: FeatureOption[] };
  experiment_rollout?: { rollout_percentage?: number; multivariate_feature_state_values?: RolloutAllocation[] };
};

type Snapshot = {
  source?: string;
  cohort_label?: string;
  cohort_note?: string;
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

type Arm = { key: string; value: string; allocation: number };

function getExposureCounts(snapshot: ExposureSnapshot | null | undefined): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const point of snapshot?.payload?.timeseries?.points ?? []) {
    for (const [variant, count] of Object.entries(point.new_identities ?? {})) {
      if (Number.isFinite(count)) counts[variant] = (counts[variant] ?? 0) + count;
    }
  }
  return counts;
}

function getArms(experiment: ExperimentSnapshot | null | undefined): Arm[] {
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
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'not reported';
  const percent = value >= 0 && value <= 1 ? value * 100 : value;
  return `${percent.toFixed(1)}%`;
}

/** Only a readable interval explicitly included in Flagsmith's lift string can satisfy this check. */
function flagsmithIntervalExcludesZero(lift: string): boolean | null {
  if (!/interval/i.test(lift)) return null;
  const match = lift.match(/(?:95%[^\d+-]*)?(?:credible\s+)?interval[^\d+-]*[\[(]?\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))%?\s*(?:,|\bto\b|–|—)\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))%?\s*[\])]?/i);
  if (!match) return null;
  const lower = Number(match[1]);
  const upper = Number(match[2]);
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower > upper) return null;
  return lower > 0 || upper < 0;
}

function buildVerdict(result: ExperimentResults, experiment: ExperimentSnapshot | null | undefined) {
  const arms = getArms(experiment);
  const spatialArm = arms.find((arm) => arm.value === 'spatial_impact');
  const treatment = result.variants.find((variant) => variant.variant === spatialArm?.key)
    ?? result.variants.find((variant) => variant.variant !== 'control');
  if (!treatment) return { status: 'inconclusive', sentence: 'inconclusive — Flagsmith has not returned a spatial_impact variant result.' };

  const chanceValue = result.statistics?.chance_to_win?.[treatment.variant];
  const chance = typeof chanceValue === 'number' ? (chanceValue > 1 ? chanceValue / 100 : chanceValue) : null;
  const numericInf = result.raw_metrics?.[0]?.inference?.[treatment.variant];
  const intervalExcludesZero =
    typeof numericInf?.ci_low === 'number' && typeof numericInf?.ci_high === 'number'
      ? numericInf.ci_low > 0 || numericInf.ci_high < 0
      : flagsmithIntervalExcludesZero(result.statistics.lift);
  const control = result.variants.find((variant) => variant.variant === 'control');
  const nText = `Flagsmith evaluations: severity_only=${control?.evaluations ?? 'not reported'}, spatial_impact=${treatment.evaluations}`;

  if (chance !== null && chance < 0.05) {
    return {
      status: 'losing',
      sentence: `losing — spatial_impact chance_to_win=${formatChance(chanceValue)} (<5%); ${nText}; lift and interval as Flagsmith reports it: ${result.statistics.lift}.`,
    };
  }
  if (chance !== null && chance > 0.95 && intervalExcludesZero === true) {
    return {
      status: 'winning',
      sentence: `winning — spatial_impact chance_to_win=${formatChance(chanceValue)} (>95%) and Flagsmith's reported lift interval excludes zero; ${nText}; lift and interval as Flagsmith reports it: ${result.statistics.lift}.`,
    };
  }
  const needText = result.statistics.sample_size_warning || 'Flagsmith has not reported how many additional evaluations per arm are needed.';
  return {
    status: 'inconclusive',
    sentence: `inconclusive — spatial_impact chance_to_win=${formatChance(chanceValue)}; ${nText}; lift and interval as Flagsmith reports it: ${result.statistics.lift}; additional per-arm sample need: ${needText}.`,
  };
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

  const result = snapshot?.result ?? null;
  const counts = getExposureCounts(snapshot?.exposures);
  const arms = getArms(snapshot?.experiment);
  const exposureTotal = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const verdict = result ? buildVerdict(result, snapshot?.experiment) : null;

  return <div className="min-h-screen bg-slate-50 text-slate-900"><Header />
    <main className="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-sky-700">Flagsmith Experiment Results · Experiment 581</p>
        <h1 className="text-3xl font-semibold">Incident prioritization</h1>
        <p className="text-sm text-slate-700"><strong>Cohort: scripted QA operators, simulated.</strong> These synthetic persona choices do not measure human performance.</p>
        <p className="text-sm text-slate-600">Hypothesis: spatial-impact ranking raises mean consequence capture for scripted QA operators, simulated, compared with severity-only ranking.</p>
      </header>

      <section className="space-y-4 rounded border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Flagsmith results snapshot</h2>
          <button onClick={() => void load()} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Load latest Flagsmith payload</button>
        </div>
        {loading ? <p className="text-sm text-slate-500">Requesting Flagsmith experiment data…</p> : <>
          <p className="text-sm">Flagsmith API answered: <strong>{snapshot?.api_answered ? 'yes' : 'no'}</strong>{snapshot?.experiment_id ? ` · Experiment ${snapshot.experiment_id}` : ''}</p>
          {snapshot?.dashboard_url && <a className="text-sm font-medium text-sky-700 underline" href={snapshot.dashboard_url} target="_blank" rel="noreferrer">Open experiment 581 in Flagsmith</a>}
          {snapshot?.cohort_note && <p className="rounded bg-sky-50 p-3 text-sm text-sky-950">{snapshot.cohort_label}: {snapshot.cohort_note}</p>}
          {snapshot?.error && <p role="alert" className="break-words rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Flagsmith request failed: {snapshot.error}</p>}
          {snapshot?.errors && <p role="alert" className="break-words rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Some Flagsmith endpoints did not answer: {JSON.stringify(snapshot.errors)}</p>}

          {result ? <>
            <div className="rounded border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Generated verdict for scripted QA operators, simulated</p>
              <p className="mt-1 text-xl font-semibold">{verdict?.status}</p>
              <p className="mt-2 text-sm leading-6">{verdict?.sentence}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead><tr className="border-b text-slate-500"><th className="py-2">Flagsmith variant</th><th>Evaluations</th><th>Sum</th><th>Mean value</th><th>Chance to beat control</th></tr></thead>
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
              <div className="rounded bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Flagsmith sample-size warning</p><p className="mt-1 break-words font-medium">{result.statistics.sample_size_warning ?? 'None reported by Flagsmith'}</p></div>
            </div>
          </> : <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-medium">{snapshot?.result_state === 'not_computed'
              ? `Flagsmith has not computed a result yet: ${exposureTotal} exposures, conversion count unavailable in the null results payload.`
              : snapshot?.result_state === 'invalid_payload'
                ? 'Flagsmith answered, but the response did not match the documented ExperimentResults fields. No result or verdict is inferred.'
                : 'Flagsmith did not answer the results request; no local or SQLite result is shown.'}</p>
          </div>}

          <div className="space-y-2 rounded border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">Flagsmith exposure split</h3><span className="text-xs text-slate-500">{exposureTotal} identities in the experiment exposure payload</span></div>
            <p className="text-sm text-slate-600">Exposure counts and configured allocation below come from Flagsmith. The experiment API does not provide a separate computed SRM statistic in the documented result payload; the Flagsmith sample-size warning is shown above when available.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {arms.map((arm) => {
                const exposures = counts[arm.key] ?? 0;
                const observedShare = exposureTotal ? exposures / exposureTotal * 100 : null;
                return <p key={arm.key} className="rounded bg-slate-50 p-3 text-sm">
                  <strong>{armLabel(arm.key, snapshot?.experiment)}</strong>: {exposures} Flagsmith exposures · observed {observedShare === null ? '—' : `${observedShare.toFixed(1)}%`} · configured {arm.allocation}%
                </p>;
              })}
            </div>
            {snapshot?.exposures?.as_of && <p className="text-xs text-slate-500">Flagsmith exposure snapshot as of {new Date(snapshot.exposures.as_of).toLocaleString()}.</p>}
          </div>
          {result && <details><summary className="cursor-pointer text-sm font-medium">Raw documented Flagsmith results payload</summary><pre className="mt-3 max-h-[32rem] overflow-auto rounded bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(result, null, 2)}</pre></details>}
        </>}
      </section>

      <p className="text-xs text-slate-500">This page uses the Flagsmith Management API for results and exposures. It never presents SQLite values or a locally calculated interval as a Flagsmith result.</p>
    </main>
  </div>;
}
