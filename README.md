# TerraLens

TerraLens is a three-panel incident-prioritization task for a synthetic Jaipur scenario. Flagsmith assigns the ranking strategy and receives the exposure and outcome events; the app reads experiment results from the Flagsmith Management API.

## Hypothesis

Adding spatial consequence to incident ranking increases operators’ mean consequence capture compared with severity-only ranking.

## Five-minute setup

1. Install Node.js 22 or later and npm.
2. Install dependencies and copy the environment template:

   ```powershell
   npm ci
   Copy-Item .env.example .env.local
   ```

3. Fill the three required credentials in `.env.local`: the Development client environment key, Development server environment key, and an organisation Management API key. Their origins are listed under [Environment variables](#environment-variables). The non-secret experiment and project IDs are already set to `581` and `55892`.
4. Generate the ignored server-only benchmark file and start the app:

   ```powershell
   npm run benchmark:recompute
   npm run dev
   ```

5. Open `/flags/health`, then `/task`. Open `/analytics` to view Flagsmith results. Use a real operator run for outcome measurement; the offline projection script does not send events.

## Flagsmith dashboard setup

The live resources are in **Flagsmith → TerraLens (project 55892) → Development**.

1. Under Environments, open `incident_prioritization_strategy`. Its enabled multivariate value is `severity_only`, with one keyed option `Variant_1` whose value is `spatial_impact`.
2. Under Experiments, open **TerraLens: Spatial Impact vs Severity**, experiment **581**. It is Running, has a 100% rollout, and assigns Control 50% / Variant_1 50%.
3. The experiment detail shows `priority_task_submitted` as the primary metric and Mean in its Analysis table. The two additional metric associations are `priority_task_success` and `task_duration_seconds`; the current detail page does not show them as separate rows. They were verified through the documented `GET /api/v1/environments/{environment_key}/experiments/581/metrics/` endpoint.
4. The experiment audience is the full environment (`match: any`, no segment IDs). No segment is used by the experiment.

Do not change the live split while collecting results. Flagsmith’s experiment page is the source for exposures and statistical results.

## How Flagsmith is used

| Flag, config, metric, or segment | Live value | Reason |
|---|---|---|
| Multivariate flag `incident_prioritization_strategy` | Control value `severity_only`; keyed `Variant_1` value `spatial_impact`; 50/50 split | Flagsmith’s `getExperimentFlag` assignment decides which ranking is rendered. The app records an exposure when that ranking is displayed and refuses task participation if Flagsmith cannot verify the arm. |
| Model config flag name `incident_prioritization_model_config` | Not present in the live Flagsmith project. When no value is returned, the app uses its validated code defaults and marks them as not remotely verified. | Keeps the scoring rule explicit. The strategy flag remains the assignment source; the weights below are not claimed as live Flagsmith remote config. |
| Code default, `severity_only` | Population/facility/accessibility weights `0/0/0`; `mix_factor` `0.45` | Keeps the control ranking severity-only. |
| Code default, `spatial_impact` | Population/facility/accessibility weights `0.60/0.30/0.10`; `mix_factor` `0.45` | Combines severity with population, facility, and accessibility context. |
| Task config defaults | Select 3 incidents; pass threshold 2 of 3; 120-second task timer; benchmark `v2.0`; experiment ID `581` | Defines the task and the server-validated benchmark version. |
| Boolean flag name `incident_consequence_fallback_enabled` | Not present in the live project; `hasFeature` therefore remains false | Prevents a missing spatial layer from silently becoming a treatment observation. The task fails closed if spatial context is unavailable. |
| Primary metric `priority_task_submitted` | Mean, higher is better; event `priority_task_submitted`; numeric value is server-computed `consequence_capture` in `[0,1]` | Measures the mean consequence of the selected three incidents divided by the benchmark top-three mean consequence, capped at 1. |
| Secondary metric `priority_task_success` | Occurrence, higher is better; event `priority_task_success` | Records whether at least 2 of the 3 selected incidents match the benchmark top three. |
| Guardrail metric `task_duration_seconds` | Mean, lower is better; event `task_duration_seconds` | Uses server-clock elapsed seconds from task start to submission. |
| Segment targeting | None | Both arms use the experiment’s full Development audience. There is no `qa_rehearsal` segment. |

All outcome events use the same participant identifier as the Flagsmith exposure. The server recomputes the primary value and checks the stored session arm against Flagsmith before it records outcomes.

## Results and verdict

`/api/analytics` reads the Flagsmith Management API result, exposure, and experiment endpoints. For a computed result it shows per-variant `evaluations` as exposures, `conversions`, `conversion_rate`, `chance_to_win`, `winner`, `recommendation`, and `sample_size_warning`. It shows `statistics.lift` verbatim under **lift and interval as Flagsmith reports it**. The documented result payload has no separate numeric credible-interval field, so the app does not calculate one.

The verdict text is exactly `winning`, `losing`, or `inconclusive`. Flagsmith’s glossary defines winning as over 95% chance to beat control, losing as under 5%, and inconclusive otherwise. Its SRM guidance warns at p < 0.001 once there are at least 100 identities. Below that floor, `/analytics` shows the observed and configured split and says the check is not assessed yet. [Analyse an Experiment](https://docs.flagsmith.com/experimentation/analyse-an-experiment) · [Statistics Glossary](https://docs.flagsmith.com/experimentation/statistics)

If `results` is null, the page shows the exposure total from Flagsmith and marks conversions unavailable. The exposures response does not include a conversion count, so the page does not invent zero. If the results request fails, the page says Flagsmith did not answer. It never presents SQLite or simulated values as Flagsmith results.

## Expected effect: offline projection only

Run `npm run benchmark:project` for a deterministic synthetic scenario projection. It samples selections from the existing 25-incident dataset, retains every incident in both rankings, and uses the current benchmark top three (incidents 3, 10, and 2). The severity-only positions of those targets are 6, 10, and 8; the top-rank persona now samples a 12-incident window, so the control can sometimes select two benchmark targets.

The script labels all output **OFFLINE SYNTHETIC PROJECTION — not Flagsmith results or observed participants** and does not call Flagsmith or the app API. With 200,000 simulated operator draws per persona mix, it projects:

| Persona mix | Severity-only mean capture | Spatial-impact mean capture | Projected difference (on the 0–1 capture metric) | Enrolled people per arm |
|---|---:|---:|---:|---:|
| Baseline: 35% top-rank, 25% infrastructure, 20% population, 15% imperfect, 5% delayed | 0.6777 | 0.9754 | +0.2976 (Cohen’s d 1.62) | 53 |
| Sensitivity: 60% top-rank, 15% infrastructure, 5% population, 15% imperfect, 5% delayed | 0.6064 | 0.9600 | +0.3535 (Cohen’s d 2.069) | 53 |

The planning target is 50 valid submissions per arm to meet Flagsmith’s 50-identity reporting floor, with 53 enrolled per arm allowing for the model’s 5% delayed-dispatch share. The model-only normal approximation would require fewer observations; the platform floor sets this planning minimum. These optimistic synthetic effects are not forecasts of real operator behavior or a power guarantee. Do not use them as experiment results.

## Limitations and current data

- All 25 incidents and their consequence context are synthetic. The consequence score is a prototype proxy, not a calibrated emergency-impact measure.
- As checked on 26 November 2026, the only live exposures shown were the two exposure-only QA identities: one Control and one Variant_1. They created no task sessions or outcome events. The Flagsmith result endpoint returned `results: null`; there is no measured lift or verdict yet.
- The Development Flagsmith warehouse currently reports `connected` with 851 events and 4 unique event names. Those counters include historical events; they are not 851 experiment participants. [Connect a Warehouse](https://docs.flagsmith.com/experimentation/connect-a-warehouse)
- `incident_prioritization_model_config` and `incident_consequence_fallback_enabled` are referenced by the code but are absent from the live project. Model weights currently come from the code defaults above, not a Flagsmith config value.
- SQLite stores local session and task state only. It is never the experiment-results source.
- `scripts/simulate_traffic.mjs` is disabled. `scripts/simulate_track01_traffic.mjs` only supports an explicit exposure-only smoke run; use `scripts/project_expected_effect.mjs` for offline projections.

## Environment variables

Copy `.env.example` to `.env.local`. The example contains no credentials.

| Variable | Required | Origin and use |
|---|---|---|
| `NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY` | Yes | Flagsmith Development client-side environment key; used by the browser SDK for flag evaluation and exposures. |
| `FLAGSMITH_SERVER_KEY` | Yes | Flagsmith Development server-side environment key; used by the server SDK and as the HMAC key for signed run config. Keep private. |
| `FLAGSMITH_MASTER_API_KEY` | Yes | Flagsmith organisation Management API key; used server-side to read experiment results, exposures, and warehouse status. Keep private. |
| `FLAGSMITH_EXPERIMENT_ID` | Yes | Experiment ID from the Flagsmith experiment page/URL; set to `581` for this project. |
| `NEXT_PUBLIC_FLAGSMITH_PROJECT_ID` | Yes for the dashboard link | Project ID from the Flagsmith project URL; set to `55892`. |
| `NEXT_PUBLIC_FLAG_STRATEGY` | Optional | Feature name override; defaults to the live flag `incident_prioritization_strategy`. |
| `NEXT_PUBLIC_FLAG_MODEL_CONFIG` | Optional | Remote-config feature name override; defaults to `incident_prioritization_model_config`, which is absent from the live project. |
| `NEXT_PUBLIC_FLAG_CONSEQUENCE_FALLBACK` | Optional | Boolean feature name override; defaults to `incident_consequence_fallback_enabled`, absent from the live project. |
| `NEXT_PUBLIC_METRIC_TASK_SUBMITTED` | Optional | Event name override; defaults to `priority_task_submitted`. |
| `NEXT_PUBLIC_METRIC_TASK_SUCCESS` | Optional | Event name override; defaults to `priority_task_success`. |
| `NEXT_PUBLIC_METRIC_TASK_DURATION` | Optional | Event name override; defaults to `task_duration_seconds`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Supabase project API URL; enables remote session persistence when paired with its keys. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | Supabase project anon/public API key for the browser client. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Supabase project service-role key for server persistence. Keep private. |
| `ADMIN_AUDIT_SECRET` | Optional | A secret you generate yourself for the separate protected benchmark-audit endpoint; not needed for the experiment demo. Keep private. |

`.env.local` is ignored by Git. Do not put server or Management API keys in any `NEXT_PUBLIC_*` variable. No key belongs in a commit.

## Demo

See [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for the timed 2:30 recording plan. If the result endpoint still returns `null` when recording, show the empty state and say so; do not manufacture an interval or a winner.
