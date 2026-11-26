'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ExperimentAnalytics } from '@/types';

export default function LandingPage() {
  const [analytics, setAnalytics] = useState<ExperimentAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState(false);

  useEffect(() => {
    fetch('/api/analytics')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: ExperimentAnalytics) => setAnalytics(data))
      .catch(() => setAnalyticsError(true));
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/terralens-logo.svg"
              alt="TerraLens"
              className="h-9 w-auto object-contain"
            />
          </Link>

          <nav aria-label="Primary" className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#methodology" className="hover:text-slate-900 transition-colors">
              Methodology
            </a>
            <Link href="/replay" className="hover:text-slate-900 transition-colors">
              Decision Replay
            </Link>
            <Link href="/analytics" className="hover:text-slate-900 transition-colors">
              Analytics
            </Link>
            <Link
              href="/task"
              className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded hover:bg-slate-800 transition-colors"
            >
              Open Workspace
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* 1. Hero Section */}
        <section className="border-b border-slate-200 bg-white">
          <div className="max-w-6xl mx-auto px-6 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <p className="text-xs font-mono uppercase tracking-wider text-slate-500">
                TerraLens · Geospatial Experimentation Prototype
              </p>
              <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-slate-900 leading-[1.12]">
                Don&apos;t just find the worst problem. Find the problem that matters most.
              </h1>
              <p className="text-lg text-slate-600 leading-relaxed max-w-2xl">
                TerraLens is a geospatial incident-prioritization prototype that tests whether
                spatial context can help infrastructure operators identify higher-impact incidents
                than severity-only ranking.
              </p>
              <p className="text-sm text-slate-500 border-l-2 border-slate-300 pl-4">
                Experimental prototype using synthetic Jaipur infrastructure incident scenarios. Not a
                production emergency-response system.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  href="/task"
                  className="px-5 py-3 bg-slate-900 text-white text-sm font-medium rounded hover:bg-slate-800 transition-colors"
                >
                  Explore the live experiment
                </Link>
                <a
                  href="#methodology"
                  className="px-5 py-3 border border-slate-300 bg-white text-slate-800 text-sm font-medium rounded hover:bg-slate-50 transition-colors"
                >
                  Understand the methodology
                </a>
              </div>
            </div>

            {/* Restrained Operational Preview */}
            <div className="lg:col-span-5 border border-slate-200 bg-slate-50 rounded p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
                  Scenario · Jaipur Grid (25 Incidents)
                </span>
                <span className="text-xs font-mono text-slate-600">50/50 A/B Split</span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="p-3 bg-white border border-slate-200 rounded">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-1">
                    <span>INCIDENT #7 · SUBSTATION FLOODING</span>
                    <span>SEV 7.9</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">Severity-only rank: #14</span>
                    <span className="font-medium text-sky-700">Spatial-impact rank: #2</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    High surrounding population exposure and adjacent hospital coverage.
                  </p>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-1">
                    <span>INCIDENT #1 · WATER MAIN RUPTURE</span>
                    <span>SEV 8.0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">Severity-only rank: #12</span>
                    <span className="font-medium text-sky-700">Spatial-impact rank: #5</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Dense urban corridor with multiple nearby emergency facilities.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span>Task: Select 3 priority incidents</span>
                <span>Deadline: 120 seconds</span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. The Problem */}
        <section className="max-w-6xl mx-auto px-6 py-16 border-b border-slate-200">
          <div className="max-w-3xl space-y-4">
            <h2 className="text-xs font-mono uppercase tracking-wider text-slate-500">
              The Operational Problem
            </h2>
            <h3 className="text-2xl font-semibold text-slate-900">
              Why severity-only prioritization can be insufficient
            </h3>
            <p className="text-base text-slate-600 leading-relaxed">
              Two infrastructure incidents may have similar technical severity scores but very
              different human and operational consequences. One may affect a relatively isolated
              corridor. Another may affect a densely populated neighbourhood or lie close to
              hospitals, fire stations, and constrained road access.
            </p>
            <p className="text-base text-slate-600 leading-relaxed">
              When an operator&apos;s queue is sorted strictly by engineering severity, high-consequence
              incidents in dense urban areas can be buried below isolated failures with marginally
              higher severity ratings.
            </p>
          </div>
        </section>

        {/* 3. How TerraLens Works */}
        <section className="max-w-6xl mx-auto px-6 py-16 border-b border-slate-200">
          <div className="space-y-8">
            <div className="space-y-2">
              <h2 className="text-xs font-mono uppercase tracking-wider text-slate-500">
                Workflow
              </h2>
              <h3 className="text-2xl font-semibold text-slate-900">How TerraLens works</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                {
                  step: '01',
                  title: 'Geographic representation',
                  body: '25 synthetic infrastructure incidents are mapped across Jaipur.',
                },
                {
                  step: '02',
                  title: 'Context evaluation',
                  body: 'The system evaluates severity alongside population, facilities, and access.',
                },
                {
                  step: '03',
                  title: 'Strategy assignment',
                  body: 'Flagsmith assigns each participant to one of two ranking strategies.',
                },
                {
                  step: '04',
                  title: 'Prioritization task',
                  body: 'Participants review the map and select 3 incidents within 120 seconds.',
                },
                {
                  step: '05',
                  title: 'Outcome recording',
                  body: 'Selections, completion, and duration are recorded server-side.',
                },
                {
                  step: '06',
                  title: 'Experiment analysis',
                  body: 'Results are evaluated against an independent synthetic benchmark.',
                },
              ].map((item) => (
                <div key={item.step} className="border border-slate-200 bg-white rounded p-4 space-y-2">
                  <span className="text-xs font-mono text-slate-400">{item.step}</span>
                  <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. What is being tested? */}
        <section id="methodology" className="max-w-6xl mx-auto px-6 py-16 border-b border-slate-200">
          <div className="space-y-8">
            <div className="space-y-2 max-w-3xl">
              <h2 className="text-xs font-mono uppercase tracking-wider text-slate-500">
                Experiment Arms
              </h2>
              <h3 className="text-2xl font-semibold text-slate-900">What is being tested?</h3>
              <p className="text-base text-slate-600">
                Participants see the exact same map, incidents, and deadline. Only the incident
                ranking formula changes between Variant A and Variant B.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Variant A */}
              <div className="border border-slate-200 bg-white rounded p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h4 className="text-base font-semibold text-slate-900">
                    Variant A: Severity-only (Control)
                  </h4>
                  <span className="text-xs font-mono text-amber-700">severity_only</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Incidents are ranked strictly in descending order of their reported technical
                  severity score.
                </p>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded font-mono text-sm text-slate-800">
                  S_A = Severity
                </div>
              </div>

              {/* Variant B */}
              <div className="border border-slate-200 bg-white rounded p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h4 className="text-base font-semibold text-slate-900">
                    Variant B: Spatial-impact (Treatment)
                  </h4>
                  <span className="text-xs font-mono text-sky-700">spatial_impact</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  The ranking incorporates estimated population exposure, critical facility exposure,
                  and accessibility difficulty.
                </p>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded font-mono text-sm text-slate-800 space-y-1">
                  <div>C = 0.60P + 0.30F + 0.10A</div>
                  <div>S_B = Severity × (0.55 + 0.45C)</div>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 bg-white rounded p-6 space-y-3">
              <h4 className="text-sm font-semibold text-slate-900">Variable definitions</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-slate-600">
                <div>
                  <span className="font-mono font-semibold text-slate-900">P</span>: Normalized
                  population exposure
                </div>
                <div>
                  <span className="font-mono font-semibold text-slate-900">F</span>: Normalized
                  critical-facility exposure
                </div>
                <div>
                  <span className="font-mono font-semibold text-slate-900">A</span>: Normalized
                  accessibility difficulty
                </div>
                <div>
                  <span className="font-mono font-semibold text-slate-900">C</span>: Combined
                  spatial-context score
                </div>
              </div>
              <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                Note: The weights (0.60, 0.30, 0.10) and scaling factors (0.55, 0.45) are
                experimental assumptions for this prototype, not empirically calibrated real-world
                coefficients.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Experiment Methodology */}
        <section className="max-w-6xl mx-auto px-6 py-16 border-b border-slate-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-5 space-y-3">
              <h2 className="text-xs font-mono uppercase tracking-wider text-slate-500">
                Experimental Design
              </h2>
              <h3 className="text-2xl font-semibold text-slate-900">
                The experiment methodology
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Both groups must experience identical task conditions—the same map, incident
                descriptions, and 120-second deadline—so that any observed difference in outcome
                can be attributed to the ranking strategy rather than interface differences.
              </p>
            </div>

            <div className="lg:col-span-7 border border-slate-200 bg-white rounded divide-y divide-slate-200 text-sm">
              {[
                ['Design', 'Between-subject randomized controlled experiment'],
                ['Allocation', '50/50 split via Flagsmith feature flag'],
                ['Identity', 'Persistent anonymous participant UUID'],
                ['Dataset', '25 synthetic Jaipur infrastructure incident scenarios'],
                ['Task', 'Select 3 priority incidents within a 120-second deadline'],
                ['Experimental variable', 'Incident list ranking strategy (Severity-only vs Spatial-impact)'],
              ].map(([label, value]) => (
                <div key={label} className="px-5 py-3.5 flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="font-medium text-slate-900">{label}</span>
                  <span className="text-slate-600">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. What do the metrics mean? */}
        <section className="max-w-6xl mx-auto px-6 py-16 border-b border-slate-200">
          <div className="space-y-8">
            <div className="space-y-2 max-w-3xl">
              <h2 className="text-xs font-mono uppercase tracking-wider text-slate-500">
                Measurement
              </h2>
              <h3 className="text-2xl font-semibold text-slate-900">What do the metrics mean?</h3>
              <p className="text-sm text-slate-600">
                The primary metric is binary at the participant level (success or not), evaluated
                server-side against an independent synthetic reference benchmark.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="border border-slate-200 bg-white rounded p-6 space-y-2">
                <h4 className="text-base font-semibold text-slate-900">Priority Task Success</h4>
                <p className="text-xs font-mono text-slate-500">Primary metric · Percentage (higher is better)</p>
                <p className="text-sm text-slate-600 leading-relaxed pt-1">
                  Whether the participant selects at least two of the three incidents ranked highest
                  by the independent synthetic reference benchmark.
                </p>
              </div>

              <div className="border border-slate-200 bg-white rounded p-6 space-y-2">
                <h4 className="text-base font-semibold text-slate-900">Task Completion</h4>
                <p className="text-xs font-mono text-slate-500">Secondary metric · Percentage (higher is better)</p>
                <p className="text-sm text-slate-600 leading-relaxed pt-1">
                  Whether the participant submits three valid incidents before the 120-second
                  deadline expires. Completion alone does not imply task success.
                </p>
              </div>

              <div className="border border-slate-200 bg-white rounded p-6 space-y-2">
                <h4 className="text-base font-semibold text-slate-900">Task Duration</h4>
                <p className="text-xs font-mono text-slate-500">Secondary metric · Seconds (lower is better, subject to success)</p>
                <p className="text-sm text-slate-600 leading-relaxed pt-1">
                  The server-measured time taken to complete the prioritization task, in seconds.
                  Faster decisions are only desirable if prioritization quality is maintained.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Explore the project */}
        <section className="max-w-6xl mx-auto px-6 py-16 border-b border-slate-200">
          <div className="space-y-8">
            <div className="space-y-2">
              <h2 className="text-xs font-mono uppercase tracking-wider text-slate-500">
                Guided Walkthrough
              </h2>
              <h3 className="text-2xl font-semibold text-slate-900">Explore the project</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Link
                href="/replay"
                className="group border border-slate-200 bg-white rounded p-6 space-y-3 hover:border-slate-400 transition-colors"
              >
                <span className="text-xs font-mono text-slate-500">STEP 1</span>
                <h4 className="text-lg font-semibold text-slate-900 group-hover:underline">
                  Decision Replay
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Compare the two ranking strategies side by side and see how spatial context
                  changes incident order.
                </p>
              </Link>

              <Link
                href="/task"
                className="group border border-slate-200 bg-white rounded p-6 space-y-3 hover:border-slate-400 transition-colors"
              >
                <span className="text-xs font-mono text-slate-500">STEP 2</span>
                <h4 className="text-lg font-semibold text-slate-900 group-hover:underline">
                  Operator Workspace
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Explore the Jaipur map, investigate incidents, and experience the 120-second
                  prioritization task.
                </p>
              </Link>

              <Link
                href="/analytics"
                className="group border border-slate-200 bg-white rounded p-6 space-y-3 hover:border-slate-400 transition-colors"
              >
                <span className="text-xs font-mono text-slate-500">STEP 3</span>
                <h4 className="text-lg font-semibold text-slate-900 group-hover:underline">
                  Experiment Analytics
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Inspect participant distribution, task outcomes, completion rates, duration, and
                  statistical uncertainty.
                </p>
              </Link>
            </div>
          </div>
        </section>

        {/* 8. Results Preview */}
        <section className="max-w-6xl mx-auto px-6 py-16 border-b border-slate-200">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-2">
                <h2 className="text-xs font-mono uppercase tracking-wider text-slate-500">
                  Observed Experiment Data
                </h2>
                <h3 className="text-2xl font-semibold text-slate-900">Results preview</h3>
              </div>
              <Link
                href="/analytics"
                className="text-sm font-medium text-slate-900 underline hover:text-slate-600"
              >
                View full analytics →
              </Link>
            </div>

            {analytics ? (
              <div className="border border-slate-200 bg-white rounded p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <div className="text-xs text-slate-500">Completed Participants</div>
                    <div className="text-2xl font-semibold font-mono text-slate-900 mt-1">
                      {analytics.total_participants}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {analytics.control_count} Control · {analytics.treatment_count} Treatment
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Control Success Rate</div>
                    <div className="text-2xl font-semibold font-mono text-slate-900 mt-1">
                      {analytics.control_success_rate}%
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Severity-only ranking</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Treatment Success Rate</div>
                    <div className="text-2xl font-semibold font-mono text-sky-700 mt-1">
                      {analytics.treatment_success_rate}%
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Spatial-impact ranking</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Absolute Difference</div>
                    <div className="text-2xl font-semibold font-mono text-slate-900 mt-1">
                      {analytics.absolute_lift >= 0 ? `+${analytics.absolute_lift}` : analytics.absolute_lift} pp
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Includes simulated + human sessions
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 border-t border-slate-100 pt-3">
                  Note: These figures are computed from the local session store. Native Flagsmith
                  warehouse inference is separate, and simulated sessions are included in the
                  combined cohort. See the Analytics page for cohort breakdowns and limitations.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 bg-white rounded p-6 text-sm text-slate-600">
                {analyticsError
                  ? 'Experiment results are currently unavailable from the local analytics endpoint.'
                  : 'Loading observed experiment summary...'}
              </div>
            )}
          </div>
        </section>

        {/* 9. Data and Limitations */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xs font-mono uppercase tracking-wider text-slate-500">
                Transparency
              </h2>
              <h3 className="text-2xl font-semibold text-slate-900">Data and limitations</h3>
            </div>

            <div className="border border-slate-200 bg-white rounded p-6">
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm text-slate-600 list-disc pl-5">
                <li>All 25 incident scenarios are synthetic Jaipur infrastructure scenarios.</li>
                <li>Facility locations are project data and are not authoritative verified records.</li>
                <li>
                  The population layer is procedurally generated using a radial-decay model, not an
                  integrated WorldPop population raster.
                </li>
                <li>The city boundary is an approximate project boundary, not an official administrative boundary.</li>
                <li>TerraLens is an experimental prototype, not a production emergency-response system.</li>
                <li>Results from simulated participants do not establish real human operator behaviour.</li>
                <li>The independent benchmark is a synthetic reference model, not real-world ground truth.</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      {/* 10. Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-slate-500">
          <div className="space-y-1">
            <div className="font-semibold text-slate-900">
              TerraLens · WeMakeDevs × Flagsmith Toggle Wars (Track 01)
            </div>
            <div>
              Next.js · TypeScript · Leaflet · Flagsmith Experimentation · SQLite / Supabase
            </div>
            <div>
              Synthetic Jaipur dataset &amp; radial-decay population model. Prototype for
              experimentation only.
            </div>
          </div>
          <div className="flex items-center gap-5">
            <a href="#methodology" className="hover:text-slate-900 underline">
              Methodology
            </a>
            <Link href="/replay" className="hover:text-slate-900 underline">
              Decision Replay
            </Link>
            <Link href="/analytics" className="hover:text-slate-900 underline">
              Analytics
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
