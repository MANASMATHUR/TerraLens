'use client';

import { useEffect, useState } from 'react';
import { getOrCreateParticipantId } from '@/lib/experiment/identity';
import { initFlagsmith, METRIC_NAMES, getLastFlagsmithEvent } from '@/lib/flagsmith/client';

export default function FlagsmithHealthPage() {
  const [state, setState] = useState({ id: 'Loading…', variant: 'Unknown', exposure: 'Checking', api: 'Checking', warehouse: 'Checking', metrics: 'Checking' });
  const [lastEvent, setLastEvent] = useState<{ name: string; value?: number; flushed?: boolean; at: string } | null>(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const id = getOrCreateParticipantId();
      if (id === null) {
        if (active) setState({ id: 'Unassigned', variant: 'severity_only', exposure: 'Not recorded', api: 'Not called (no participant ID)', warehouse: 'unknown', metrics: 'Management API unavailable' });
        return;
      }
      const assignment = await initFlagsmith(id);
      const warehouseResponse = await fetch('/api/flags/health', { cache: 'no-store' });
      const warehouseData = await warehouseResponse.json();
      const exposure = localStorage.getItem('terralens_flagsmith_exposure');
      if (!active) return;
      setState({
        id,
        variant: assignment.controlState === 'experiment_active' ? assignment.variant : 'Unavailable',
        exposure: exposure ? `Recorded (${JSON.parse(exposure).variant})` : 'Not yet exposed; view /task to record',
        api: assignment.controlState === 'experiment_active' ? 'Answered' : `No (${assignment.controlState})`,
        warehouse: warehouseData.warehouse || 'unknown',
        metrics: Array.isArray(warehouseData.metrics) && warehouseData.metrics.length ? warehouseData.metrics.join(', ') : warehouseData.metrics_api_answered ? 'No metrics configured' : 'Management API unavailable',
      });
      const storedEvent = localStorage.getItem('terralens_last_flagsmith_event');
      setLastEvent(storedEvent ? JSON.parse(storedEvent) : getLastFlagsmithEvent());
    };
    void run();
    return () => { active = false; };
  }, []);

  const rows: [string, string][] = [
    ['Participant ID', state.id], ['Current variant', state.variant], ['Exposure status', state.exposure],
    ['Flagsmith SDK answered', state.api], ['Flagsmith metric names', state.metrics],
    ['App event names', `${METRIC_NAMES.submitted}, ${METRIC_NAMES.success}, ${METRIC_NAMES.duration}`],
    ['Flagsmith warehouse', state.warehouse],
    ['Last event flush', lastEvent ? `${lastEvent.name}${lastEvent.value === undefined ? '' : ` (value ${lastEvent.value})`} · ${lastEvent.flushed ? 'flush completed' : 'flush not confirmed'} · ${lastEvent.at}` : 'No submission event recorded yet'],
  ];
  return <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
    <div className="mx-auto max-w-3xl space-y-6">
      <a className="text-sky-300 text-sm" href="/">← TerraLens</a>
      <header><p className="font-mono text-xs uppercase tracking-widest text-sky-300">Experiment instrumentation</p><h1 className="mt-2 text-3xl font-semibold">Flagsmith health</h1><p className="mt-2 text-slate-400">Live client check. Exposure is recorded when the ranking is displayed.</p></header>
      <section className="divide-y divide-slate-800 rounded border border-slate-800 bg-slate-900">
        {rows.map(([label, value]) => <div key={label} className="grid gap-2 p-4 sm:grid-cols-[180px_1fr]"><span className="text-sm text-slate-400">{label}</span><span className="break-all font-mono text-sm">{value}</span></div>)}
      </section>
      <p className="text-xs text-slate-500">Metric definitions and experiment results are computed by Flagsmith only after the environment has a connected warehouse.</p>
    </div>
  </main>;
}
