'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/layout/Header';
import LeftIncidentPanel from '@/components/ranking/LeftIncidentPanel';
import RightTriageSidebar from '@/components/ranking/RightTriageSidebar';

// Dynamically import MapLibre GL JaipurMap with OpenFreeMap dark style (SSR disabled)
const JaipurMapLibre = dynamic(() => import('@/components/map/JaipurMapLibre'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#0F172A] flex flex-col items-center justify-center font-sans text-xs text-sky-400 space-y-2">
      <div className="w-5 h-5 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
      <span>Initializing OpenFreeMap Vector Basemap (Jaipur WGS84)...</span>
    </div>
  ),
});
import {
  getOrCreateParticipantId,
  setCachedVariant,
} from '@/lib/experiment/identity';
import flagsmith from '@flagsmith/flagsmith';
import { initFlagsmith, recordDisplayedExperiment, isConsequenceFallbackEnabled } from '@/lib/flagsmith/client';
import { rankIncidents } from '@/lib/scoring/engine';
import { ExperimentControlState, ExperimentRemoteConfig } from '@/lib/flagsmith/config-schema';
import { IncidentWithContext, ExperimentVariant, SubmissionResult } from '@/types';
import WhyThisIncidentModal from '@/components/incidents/WhyThisIncidentModal';
import { showSpatialContext } from '@/lib/experiment/gate';

// ─── Experiment Gate Screens ───────────────────────────────────────────────────

function ConnectingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
      <div className="max-w-sm w-full text-center space-y-4 p-8">
        <div className="w-6 h-6 rounded-full border-2 border-sky-600 border-t-transparent animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-700">Connecting to Flagsmith</p>
        <p className="text-xs text-slate-500">Verifying experiment assignment…</p>
      </div>
    </div>
  );
}

function ExperimentUnavailableScreen({ participantId }: { participantId: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans p-6">
      <div className="max-w-md w-full bg-white border border-amber-200 rounded-lg p-6 space-y-4 shadow-sm">
        <div className="flex items-start space-x-3">
          <div className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-600">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Experiment Service Unavailable</h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              TerraLens could not reach the Flagsmith experimentation platform. Without a verified remote
              assignment, experiment participation is not permitted.
            </p>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs font-mono text-slate-700 space-y-1">
          <div><span className="text-slate-400">state:</span> experiment_unavailable</div>
          <div><span className="text-slate-400">participant:</span> {participantId.slice(0, 16)}…</div>
          <div><span className="text-slate-400">source:</span> flagsmith.com</div>
        </div>
        <p className="text-xs text-slate-500">
          This application requires Flagsmith to function. Please check your network connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded transition-colors"
        >
          Retry Connection
        </button>
      </div>
    </div>
  );
}

function InvalidConfigurationScreen({ participantId }: { participantId: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans p-6">
      <div className="max-w-md w-full bg-white border border-red-200 rounded-lg p-6 space-y-4 shadow-sm">
        <div className="flex items-start space-x-3">
          <div className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-600">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd"/>
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Invalid Experiment Configuration</h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Flagsmith returned a variant value that does not match a recognised experiment arm.
              The experiment configuration must be corrected before participation is permitted.
            </p>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs font-mono text-slate-700 space-y-1">
          <div><span className="text-slate-400">state:</span> invalid_configuration</div>
          <div><span className="text-slate-400">participant:</span> {participantId.slice(0, 16)}…</div>
          <div><span className="text-slate-400">expected:</span> severity_only | spatial_impact</div>
        </div>
        <p className="text-xs text-slate-500">
          Contact the experiment administrator to verify the Flagsmith feature flag configuration.
        </p>
      </div>
    </div>
  );
}

function NotEnrolledScreen({ participantId }: { participantId: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-6 space-y-4 shadow-sm">
        <div className="flex items-start space-x-3">
          <div className="w-5 h-5 mt-0.5 flex-shrink-0 text-slate-400">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd"/>
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Not Enrolled in Experiment</h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Your participant identity is outside the current experiment traffic allocation.
              Experiment participation requires a verified remote assignment from Flagsmith.
            </p>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs font-mono text-slate-700 space-y-1">
          <div><span className="text-slate-400">state:</span> experiment_not_enrolled</div>
          <div><span className="text-slate-400">participant:</span> {participantId.slice(0, 16)}…</div>
        </div>
        <a
          href="/"
          className="block w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded text-center transition-colors"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
}

// ─── Experiment Governance Strip ───────────────────────────────────────────────

function ExperimentGovernanceStrip({
  participantId,
  variant,
  remoteConfig,
  storageMode,
}: {
  participantId: string;
  variant: ExperimentVariant;
  remoteConfig: ExperimentRemoteConfig;
  storageMode: 'supabase' | 'local_sqlite';
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-800 text-slate-300 text-[10px] font-mono border-b border-slate-700">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
      >
        <span className="flex items-center space-x-3">
          <span className="text-emerald-400 font-semibold">● EXPERIMENT ACTIVE</span>
          <span className="text-slate-400">ID:{remoteConfig.experiment_id}</span>
          <span className="text-sky-300">variant:{variant}</span>
          <span className="text-slate-400">source:flagsmith_remote</span>
          <span className="text-slate-400">storage:{storageMode}</span>
        </span>
        <span className="text-slate-500">{expanded ? '▲' : '▼'} governance</span>
      </button>

      {expanded && (
        <div className="px-3 pb-2 pt-1 grid grid-cols-3 gap-x-6 gap-y-0.5 border-t border-slate-700 text-[10px]">
          <div><span className="text-slate-500">experiment_id:</span> {remoteConfig.experiment_id}</div>
          <div><span className="text-slate-500">experiment_version:</span> {remoteConfig.experiment_version}</div>
          <div><span className="text-slate-500">config_version:</span> {remoteConfig.configuration_version}</div>
          <div><span className="text-slate-500">benchmark_version:</span> {remoteConfig.benchmark_version}</div>
          <div><span className="text-slate-500">selection_limit:</span> {remoteConfig.selection_limit}</div>
          <div><span className="text-slate-500">time_limit:</span> {remoteConfig.task_time_limit_seconds}s</div>
          {variant === 'spatial_impact' && (
            <>
              <div><span className="text-slate-500">pop_weight:</span> {remoteConfig.population_weight}</div>
              <div><span className="text-slate-500">facility_weight:</span> {remoteConfig.facility_weight}</div>
              <div><span className="text-slate-500">access_weight:</span> {remoteConfig.accessibility_weight}</div>
              <div><span className="text-slate-500">mix_factor:</span> {remoteConfig.mix_factor}</div>
              <div><span className="text-slate-500">top3_pass_matches:</span> {remoteConfig.top3_pass_matches}</div>
              <div><span className="text-slate-500">remote_verified:</span> {String(remoteConfig.is_remote_verified)}</div>
            </>
          )}
          <div className="col-span-3 mt-0.5 text-slate-500">
            participant: {participantId}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Task Page ────────────────────────────────────────────────────────────

export default function TaskPage() {
  const [participantId, setParticipantId] = useState<string>('');
  const [variant, setVariant] = useState<ExperimentVariant>('spatial_impact');
  const [remoteConfig, setRemoteConfig] = useState<ExperimentRemoteConfig | null>(null);
  const [controlState, setControlState] = useState<ExperimentControlState>('connecting');
  const [incidents, setIncidents] = useState<IncidentWithContext[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [taskStarted, setTaskStarted] = useState(false);
  const [taskStartedAt, setTaskStartedAt] = useState<string | null>(null);
  const [modelConfigSignature, setModelConfigSignature] = useState<string | null>(null);
  const [tutorialSeconds, setTutorialSeconds] = useState(20);
  const [degradedReason, setDegradedReason] = useState<string | null>(null);
  const [timeExpired, setTimeExpired] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(120);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [storageMode, setStorageMode] = useState<'supabase' | 'local_sqlite'>('local_sqlite');
  const [whyModalIncident, setWhyModalIncident] = useState<IncidentWithContext | null>(null);
  const [isWhyModalOpen, setIsWhyModalOpen] = useState<boolean>(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState<boolean>(false);
  const [layerVisibility, setLayerVisibility] = useState({
    populationHeatmap: true,
    hospitals: true,
    fireStations: true,
    schools: true,
    roads: true,
    impactRadius: true,
    boundary: true,
  });
  const [populationOpacity, setPopulationOpacity] = useState(62);
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  const handleToggleLayer = (layerKey: keyof typeof layerVisibility) => {
    setLayerVisibility((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  // Initialize participant identity, Flagsmith variant & load incidents
  useEffect(() => {
    async function setup() {
      const participantIdValue = getOrCreateParticipantId();
      if (participantIdValue === null) {
        setVariant('severity_only');
        setControlState('unassigned');
        try {
          const response = await fetch('/api/incidents');
          if (response.ok) {
            const rawIncidents: IncidentWithContext[] = await response.json();
            setIncidents(rankIncidents(rawIncidents, 'severity_only'));
          }
        } finally {
          setIsLoading(false);
        }
        return;
      }
      const pid = participantIdValue;
      setParticipantId(pid);
      const savedRunRaw = localStorage.getItem(`terralens_run_${pid}`);
      let savedRun: any = null;
      if (savedRunRaw) {
        try {
          savedRun = JSON.parse(savedRunRaw);
          if (savedRun.startedAt) {
            setTaskStarted(true);
            setTaskStartedAt(savedRun.startedAt);
            setModelConfigSignature(savedRun.modelConfigSignature || null);
            setSelectedIds(Array.isArray(savedRun.selectedIds) ? savedRun.selectedIds : []);
            if (savedRun.result) setResult(savedRun.result);
            if (savedRun.degradedReason) setDegradedReason(savedRun.degradedReason);
          }
        } catch { localStorage.removeItem(`terralens_run_${pid}`); }
      }
      setControlState('connecting');

      // ── Flagsmith assignment (fail-closed) ──────────────────────────────────
      let cachedV: ExperimentVariant | null = null;
      let resolvedConfig: ExperimentRemoteConfig | null = null;
      let resolvedControlState: ExperimentControlState = 'connecting';

      {
        const assignment = await initFlagsmith(pid, savedRun?.modelConfig);
        resolvedControlState = assignment.controlState;

        if (resolvedControlState !== 'experiment_active') {
          // Fail closed — do not let participant enter the experiment.
          setControlState(resolvedControlState);
          setIsLoading(false);
          return;
        }

        cachedV = assignment.variant;
        resolvedConfig = assignment.remoteConfig ?? null;
        if (cachedV === null) {
          setVariant('severity_only');
          setControlState('unassigned');
          setIsLoading(false);
          return;
        }
        setCachedVariant(cachedV);
      }

      if (cachedV === null) {
        setVariant('severity_only');
        setControlState('unassigned');
        return;
      }
      setVariant(cachedV);
      setRemoteConfig(resolvedConfig);
      setControlState(resolvedControlState);

      // ── Load incidents & rank ───────────────────────────────────────────────
      try {
        const res = await fetch('/api/incidents');
        if (res.ok) {
          const rawIncidents: IncidentWithContext[] = await res.json();
          let runDegradedReason: string | null = savedRun?.degradedReason || null;
          const consequenceLayerReady = rawIncidents.length > 0 && rawIncidents.every((item) =>
            Number.isFinite(item.context?.population_index) &&
            Number.isFinite(item.context?.facility_index) &&
            Number.isFinite(item.context?.accessibility_index)
          );
          const fallbackAllowed = isConsequenceFallbackEnabled();
          if (cachedV === 'spatial_impact' && !consequenceLayerReady && fallbackAllowed) {
            cachedV = 'severity_only';
            runDegradedReason = 'Spatial consequence data did not load. Severity-only ranking is active for this run.';
            setVariant('severity_only');
            setDegradedReason(runDegradedReason);
          }
          if (cachedV === 'spatial_impact' && !consequenceLayerReady && !fallbackAllowed) {
            setControlState('invalid_configuration');
            return;
          }
          // This is the exposure point: resolve and record only when the ranked variation is about to render.
          if (!runDegradedReason) {
            const displayed = await recordDisplayedExperiment(pid);
            const displayedVariant = displayed.variant;
            if (displayedVariant !== 'severity_only' && displayedVariant !== 'spatial_impact') {
              setVariant('severity_only');
              setControlState('unassigned');
              return;
            }
            cachedV = displayedVariant;
            setVariant(cachedV);
            setCachedVariant(cachedV);
          }
          setControlState('experiment_active');
          if (cachedV === null) {
            setVariant('severity_only');
            setControlState('unassigned');
            return;
          }
          const ranked = rankIncidents(rawIncidents, cachedV, resolvedConfig ?? undefined);
          setIncidents(ranked);
        }
      } catch (err) {
        console.error('Failed to load incidents:', err);
        setControlState('invalid_configuration');
      } finally {
        setIsLoading(false);
      }
    }

    setup();
  }, []);

  useEffect(() => {
    const flush = () => { void flagsmith.flushEvents(); };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) setLeftCollapsed(true);
  }, []);

  // Tutorial time is separate from the task timer.
  useEffect(() => {
    if (controlState !== 'experiment_active' || isLoading || taskStarted || tutorialSeconds <= 0) return;
    const timer = setInterval(() => setTutorialSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [tutorialSeconds, controlState, taskStarted, isLoading]);

  useEffect(() => {
    if (!taskStarted || !taskStartedAt || controlState !== 'experiment_active') return;
    const update = () => {
      const elapsed = Math.floor((Date.now() - new Date(taskStartedAt).getTime()) / 1000);
      const remaining = Math.max(0, 120 - elapsed);
      setSecondsRemaining(remaining);
      if (remaining === 0) setTimeExpired(true);
    };
    update();
    const timer = setInterval(update, 500);
    return () => clearInterval(timer);
  }, [taskStarted, taskStartedAt, controlState]);

  useEffect(() => {
    if (!participantId || !taskStartedAt) return;
    localStorage.setItem(`terralens_run_${participantId}`, JSON.stringify({
      startedAt: taskStartedAt,
      selectedIds,
      result,
      modelConfig: remoteConfig,
      modelConfigSignature,
      variant,
      degradedReason,
    }));
  }, [participantId, taskStartedAt, selectedIds, result, remoteConfig, modelConfigSignature, variant, degradedReason]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const handleToggleIncident = (id: number) => {
    if (!taskStarted || timeExpired || result) return;
    setFocusedId(id);
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 3) {
        return [prev[1], prev[2], id];
      }
      return [...prev, id];
    });
  };

  const handleHoverIncident = (id: number | null) => {
    setFocusedId(id);
  };

  const handleBeginTask = async () => {
    if (taskStarted || tutorialSeconds > 0 || !participantId) return;
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: participantId,
          variant,
          assignment_source: 'flagsmith_remote',
          flagsmith_exposure_recorded: !degradedReason,
          model_config: remoteConfig,
        }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || `Session request failed (${response.status})`);
      }
      const session = await response.json();
      if (session.completed_at) {
        setResult(session.result ?? null);
        throw new Error('This participant has already used the single attempt.');
      }
      setStorageMode(session?.storage_backend === 'supabase' ? 'supabase' : 'local_sqlite');
      if (session.model_config) setRemoteConfig(session.model_config as ExperimentRemoteConfig);
      setModelConfigSignature(session.model_config_signature || null);
      const startedAt = session.started_at || new Date().toISOString();
      setTaskStartedAt(startedAt);
      setTaskStarted(true);
      setTimeExpired(false);
      setSecondsRemaining(Math.max(0, 120 - Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not start the task.');
    }
  };

  const handleSubmit = async () => {
    if (selectedIds.length !== 3 || isSubmitting || timeExpired) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: participantId,
          selected_incident_ids: selectedIds,
          model_config: remoteConfig,
          model_config_signature: modelConfigSignature,
        }),
      });

      if (res.ok) {
        const data: SubmissionResult = await res.json();
        setResult(data);
        const eventInfo = (data as any).flagsmith_events;
        if (eventInfo) {
          localStorage.setItem('terralens_last_flagsmith_event', JSON.stringify({
            name: eventInfo.last_event,
            value: eventInfo.last_value,
            flushed: eventInfo.duration,
            at: new Date().toISOString(),
          }));
        }
        localStorage.setItem(`terralens_run_${participantId}`, JSON.stringify({
          startedAt: taskStartedAt,
          selectedIds,
          result: data,
          modelConfig: remoteConfig,
          modelConfigSignature,
          variant,
          degradedReason,
        }));
      } else {
        const err = await res.json();
        alert(err.error || 'Submission error');
      }
    } catch (err) {
      console.error('Submission failed:', err);
      alert('Could not submit. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Gate screens (fail-closed state machine) ────────────────────────────────
  if (controlState === 'connecting' || (isLoading && controlState !== 'experiment_active')) {
    return <ConnectingScreen />;
  }
  if (controlState === 'experiment_unavailable') {
    return <ExperimentUnavailableScreen participantId={participantId} />;
  }
  if (controlState === 'invalid_configuration') {
    return <InvalidConfigurationScreen participantId={participantId} />;
  }
  if (controlState === 'experiment_not_enrolled') {
    return <NotEnrolledScreen participantId={participantId} />;
  }

  // ── Normal loading spinner (experiment_active, fetching incidents) ──────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-xs text-slate-600 space-x-2">
        <div className="w-4 h-4 rounded-full border-2 border-sky-600 border-t-transparent animate-spin" />
        <span>Loading Jaipur GIS Workspace…</span>
      </div>
    );
  }

  // Briefing modal (Spec 1.4: Dim live map behind it; countdown inside button "Start in 0:17"; one-attempt rule in amber callout)
  const isBriefing = !taskStarted && controlState === 'experiment_active' && !isLoading;

  return (
    <div className="h-dvh min-h-[560px] w-screen bg-[var(--bg)] flex flex-col overflow-hidden font-sans text-[var(--text-hi)]">
      {/* Top Application Bar */}
      <Header variant={variant} participantId={participantId} storageMode={storageMode} />

      {/* Task Sub-Header: timer mm:ss, 0/3 counter, and submit button (Spec 1.4) */}
      <div className="h-12 border-b border-[var(--border-hairline)] bg-[var(--surface)] px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono text-[var(--text-mid)] uppercase tracking-wider">Timer</span>
            <span
              className={`font-mono text-[14px] font-bold tabular-nums px-2 py-0.5 rounded-[var(--radius-sm)] border ${
                secondsRemaining <= 30
                  ? 'bg-rose-50 text-[var(--bad)] border-rose-200 animate-pulse'
                  : 'bg-[var(--surface-raised)] text-[var(--text-hi)] border-[var(--border-hairline)]'
              }`}
              aria-live="polite"
            >
              {timeFormatted}
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] font-mono text-[var(--text-mid)] uppercase tracking-wider">Triage</span>
            <span className="font-mono text-[13px] font-bold text-[var(--accent)] tabular-nums">
              {selectedIds.length}/3
            </span>
          </div>
        </div>

        {/* Submit with confirmation modal trigger */}
        <button
          type="button"
          onClick={() => {
            if (selectedIds.length === 3) setIsConfirmOpen(true);
          }}
          disabled={selectedIds.length !== 3 || isSubmitting || timeExpired}
          className={`py-1.5 px-4 rounded-[var(--radius-sm)] text-[12px] font-bold transition-all ${
            selectedIds.length === 3 && !timeExpired && !isSubmitting
              ? 'bg-[var(--accent)] text-white hover:opacity-90 cursor-pointer shadow-xs'
              : 'bg-[var(--surface-raised)] text-[var(--text-low)] border border-[var(--border-hairline)] cursor-not-allowed'
          }`}
          title={selectedIds.length !== 3 ? 'Pick 3 to submit' : 'Submit selected incident priorities'}
        >
          {selectedIds.length !== 3 ? 'Pick 3 to submit' : 'Submit triage'}
        </button>
      </div>

      {/* Two-Column Console (Spec 1.2): Map 62%, Incident List 38%, no page scroll on desktop */}
      <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
        {/* Map Column (62% desktop width) */}
        <div className="w-full md:w-[62%] h-[45vh] md:h-full relative overflow-hidden border-b md:border-b-0 md:border-r border-[var(--border-hairline)]">
          <JaipurMapLibre
            incidents={incidents}
            selectedIds={selectedIds}
            onIncidentClick={handleToggleIncident}
            variant={variant}
            activeFocusedId={focusedId}
            onIncidentHover={handleHoverIncident}
            layerVisibility={layerVisibility}
            populationOpacity={populationOpacity}
            onToggleLayer={handleToggleLayer}
          />
        </div>

        {/* List Column (38% desktop width, scrolls on its own) */}
        <div className="w-full md:w-[38%] h-[55vh] md:h-full relative flex flex-col overflow-hidden bg-[var(--surface)]">
          <LeftIncidentPanel
            incidents={incidents}
            variant={variant}
            selectedIds={selectedIds}
            activeFocusedId={focusedId}
            onToggleIncident={handleToggleIncident}
            onHoverIncident={handleHoverIncident}
            onInspectWhy={(inc) => {
              setFocusedId(inc.id);
              setIsDetailPanelOpen(true);
            }}
            layerVisibility={layerVisibility}
            onToggleLayer={handleToggleLayer}
            populationOpacity={populationOpacity}
            onPopulationOpacityChange={setPopulationOpacity}
            isCollapsed={false}
            onToggleCollapsed={() => {}}
          />

          {/* Right-side detail slide-in panel over the list on incident click (Spec 1.2.9) */}
          {isDetailPanelOpen && focusedId && (
            <div className="absolute inset-0 z-30 bg-[var(--surface)] flex flex-col animate-in fade-in slide-in-from-right-4 duration-150">
              <RightTriageSidebar
                incidents={incidents}
                selectedIds={selectedIds}
                variant={variant}
                onSubmit={() => setIsConfirmOpen(true)}
                isSubmitting={isSubmitting}
                timeExpired={timeExpired}
                timeFormatted={timeFormatted}
                focusedIncident={incidents.find((i) => i.id === focusedId) || null}
                onClose={() => setIsDetailPanelOpen(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Briefing Modal */}
      {isBriefing && (
        <div className="fixed inset-0 bg-[rgba(15,23,42,0.45)] backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <section className="mx-auto w-full max-w-lg space-y-4 rounded-[var(--radius-md)] border border-[var(--border-hairline)] bg-[var(--surface)] p-6 shadow-[var(--shadow-floating)] text-[var(--text-hi)]">
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-mid)] font-semibold">
                OPERATIONAL BRIEFING · JAIPUR MONSOON
              </span>
              <span className="text-[11px] font-mono text-[var(--accent)] font-bold">
                {variant === 'spatial_impact' ? 'TREATMENT (S_B)' : 'CONTROL (S_A)'}
              </span>
            </div>

            <h1 className="text-[18px] font-bold text-[var(--text-hi)]">
              Select 3 High-Impact Incidents
            </h1>

            {/* Amber callout for one-attempt rule */}
            <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--warn)]/40 bg-amber-50 text-[12px] text-[var(--warn)] font-medium leading-relaxed">
              ⚠️ Strict Protocol: You have one attempt and 120 seconds to triage. Submissions cannot be repeated or modified once dispatched.
            </div>

            <ol className="list-decimal space-y-2 pl-4 text-[12px] text-[var(--text-mid)] leading-relaxed">
              <li>Review the ranked incident stream and map markers.</li>
              <li>{showSpatialContext(variant) ? 'Evaluate population exposure, critical hospital proximity, and route access.' : 'Evaluate SCADA severity telemetry indicators.'}</li>
              <li>Pick exactly three priority targets before the clock expires.</li>
            </ol>

            <div className="pt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={handleBeginTask}
                disabled={tutorialSeconds > 0}
                className={`py-2 px-5 rounded-[var(--radius-sm)] text-[13px] font-bold transition-all cursor-pointer ${
                  tutorialSeconds > 0
                    ? 'bg-[var(--surface-raised)] text-[var(--text-mid)] border border-[var(--border-hairline)] cursor-not-allowed'
                    : 'bg-[var(--accent)] text-white hover:opacity-90 shadow-xs'
                }`}
              >
                {tutorialSeconds > 0 ? `Start in 0:${tutorialSeconds.toString().padStart(2, '0')}` : 'Begin Task'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Confirmation Sheet */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-[rgba(15,23,42,0.45)] backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[var(--surface)] border border-[var(--border-hairline)] rounded-[var(--radius-md)] p-6 space-y-4 shadow-[var(--shadow-floating)]">
            <h2 className="text-[16px] font-bold text-[var(--text-hi)]">Confirm Dispatch Triage</h2>
            <p className="text-[12px] text-[var(--text-mid)] leading-relaxed">
              Review your 3 chosen priority targets. <strong>Submissions cannot be repeated</strong> once confirmed.
            </p>

            <div className="space-y-2 py-1">
              {selectedIds.map((id) => {
                const inc = incidents.find((i) => i.id === id);
                return (
                  <div
                    key={id}
                    className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] border border-[var(--border-hairline)] flex items-center justify-between text-[12px]"
                  >
                    <span className="font-semibold text-[var(--text-hi)]">#{id} {inc?.title.split(' - ')[0]}</span>
                    <span className="font-mono text-[var(--text-mid)]">Sev {inc?.severity_score.toFixed(0)}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="flex-1 py-2 px-3 rounded-[var(--radius-sm)] border border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-raised)] text-[var(--text-mid)] text-[12px] font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsConfirmOpen(false);
                  handleSubmit();
                }}
                disabled={isSubmitting}
                className="flex-1 py-2 px-3 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:opacity-90 text-white text-[12px] font-bold cursor-pointer"
              >
                {isSubmitting ? 'Submitting…' : 'Confirm & Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submission Results Modal */}
      {result && (
        <div className="fixed inset-0 bg-[rgba(15,23,42,0.45)] z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-300 rounded p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                  Submission Summary
                </span>
                <h2 className="text-base font-semibold text-slate-900">
                  {result.success ? 'Priority Target Met' : 'Below Target Threshold'}
                </h2>
              </div>
              <span
                className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border ${
                  result.success
                    ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                    : 'text-amber-800 bg-amber-50 border-amber-200'
                }`}
              >
                {result.matches} / 3 Benchmark Matches
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Your triage response was scored against the independent physical disruption model
              calculating service outage magnitude, cascade likelihood, and hospital vulnerability.
            </p>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[9px] text-slate-500 font-mono uppercase font-bold">Precision@3</div>
                <div className="text-sm font-bold font-mono text-slate-900">
                  {(result.precision_at_3 * 100).toFixed(0)}%
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[9px] text-slate-500 font-mono uppercase font-bold" title="Total population exposed within 1-hour service outage radius of selected incidents">Est. Pop Exposed</div>
                <div className="text-sm font-bold font-mono text-slate-900">
                  {(((result as any).consequence_metrics?.estimated_population_exposure ?? (result as any).consequence_metrics?.population_protected ?? 0) / 1000).toFixed(0)}k
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[9px] text-slate-500 font-mono uppercase font-bold">Duration</div>
                <div className="text-sm font-bold font-mono text-slate-900">{result.duration_seconds}s</div>
              </div>
            </div>

            <div className="pt-2 grid grid-cols-2 gap-2">
              <a
                href="/replay"
                className="py-2.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold text-center shadow-xs transition-colors flex items-center justify-center space-x-1"
              >
                <span>▶</span>
                <span>Decision Replay</span>
              </a>
              <a
                href="/analytics"
                className="py-2.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold text-center shadow-2xs transition-colors"
              >
                Telemetry →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Why This Incident Explainability Modal */}
      <WhyThisIncidentModal
        incident={whyModalIncident}
        variant={variant}
        isOpen={isWhyModalOpen}
        onClose={() => setIsWhyModalOpen(false)}
      />
    </div>
  );
}
