# TerraLens

TerraLens is a three-panel incident-prioritization task for a synthetic Jaipur scenario. Flagsmith assigns one of two ranking strategies and receives exposure and outcome events; `/analytics` reads results only from the Flagsmith Management API.

## Hypothesis

Among the scripted QA operators, simulated, adding spatial consequence to incident ranking raises mean consequence capture compared with severity-only ranking.

## Five-minute setup

1. Install Node.js 22 or later and npm, then install dependencies and copy the environment template:

   ```powershell
   npm ci
   Copy-Item .env.example .env.local
   ```

2. In `.env.local`, fill the Flagsmith Development client key, server key, and organisation Management API key. Their origins are listed under [Environment variables](#environment-variables). Keep keys local. The experiment and project IDs are already `581` and `55892`.
3. Generate the ignored server-only benchmark file, then start the app:

   ```powershell
   npm run benchmark:recompute
   npm run dev
   ```

4. Open `/flags/health`, then `/task`; open `/analytics` for the Flagsmith payload. A connected warehouse is required for experiment event ingestion. [Flagsmith warehouse setup](https://docs.flagsmith.com/experimentation/connect-a-warehouse)

## Flagsmith experiment 581

The live resources are in **Flagsmith → TerraLens (project 55892) → Development**.

1. Under Environments, open `incident_prioritization_strategy`. It is enabled and multivariate: the control value is `severity_only`; the one keyed option is `Variant_1`, with value `spatial_impact`.
2. Under Experiments, open **TerraLens: Spatial Impact vs Severity**, experiment **581**. The configured rollout is 100%, split 50% Control and 50% Variant_1.
3. The primary metric is `priority_task_submitted` (Mean). `priority_task_success` (Occurrence) and `task_duration_seconds` (Mean) are also attached. The metric associations were checked through the experiment metrics endpoint.
4. The experiment targets the full Development audience (`match: any`, no segment IDs). No segment is attached.

The SDK `getExperimentFlag` call supplies the arm and records an exposure. The session and submission APIs re-read the identity assignment; a claimed or stored arm that differs from Flagsmith is rejected. Submission metrics are computed server-side. The simulator does not call `trackExposureEvent` directly or choose an arm.

### Authorized scripted QA run

The traffic cohort is explicitly **scripted QA operators, simulated**. Each ID is prefixed `qa_sim_`; the session API derives and stores `is_simulated=true`. Local run progress is written to ignored `.data/track01-simulated-ledger.json`; it is not an experiment-results source.

With the app running and `.env.local` configured, run the 10-session dry run first:

```powershell
npm run simulate -- --dry-run
```

Refresh experiment 581 in the Flagsmith dashboard and verify five new exposures on each arm and nonzero primary conversion events before proceeding. Then target 100 scripted sessions per arm total, including the dry run:

```powershell
npm run simulate -- --target-per-arm 100
```

The script batches ten sessions, logs Flagsmith-assigned exposures, submissions, primary conversion-event dispatches, and success-event dispatches per arm, and exits nonzero if the split drifts beyond 10%. Counts in the script log are execution diagnostics. Quote experiment measurements only from Flagsmith after refreshing the dashboard.

**Cohort: target 100 scripted QA sessions per arm, simulated personas; not human behaviour.**

## How I used Flagsmith

| Flag, config, metric, or segment | Live value | Reason |
|---|---|---|
| Multivariate flag `incident_prioritization_strategy` | Control `severity_only`; keyed option `Variant_1` = `spatial_impact`; 50/50 | `getExperimentFlag` decides which ranking the app uses and records the exposure at flag evaluation. |
| Model config flag `incident_prioritization_model_config` | Referenced by the app but absent in the live project; validated code defaults apply and are marked not remotely verified. | Keeps the scoring inputs explicit. The strategy flag remains the sole arm authority. |
| `severity_only` config defaults | Population/facility/accessibility weights `0/0/0`; `mix_factor=0.45`. | Preserves severity-only ordering. |
| `spatial_impact` config defaults | Weights `0.60/0.30/0.10`; `mix_factor=0.45`. | Adds population, facility, and accessibility context to severity. |
| Task config defaults | Select 3 incidents; success threshold 2 of 3; 120-second limit; benchmark v2.0; experiment ID 581. | Defines the task and server-side evaluation. |
| Boolean flag `incident_consequence_fallback_enabled` | Absent from the live project; `hasFeature` remains false. | Prevents missing spatial data from silently becoming a treatment task. |
| Primary metric `priority_task_submitted` | Mean, higher is better; event value is server-computed `consequence_capture` in `[0,1]`. | Measures the mean consequence of selected incidents relative to the benchmark top-three mean, capped at 1. |
| Secondary metric `priority_task_success` | Occurrence, higher is better; emitted when at least 2 of 3 selected incidents match the benchmark top three. | Reports the binary benchmark success outcome separately. |
| Guardrail `task_duration_seconds` | Mean, lower is better; server-clock elapsed seconds. | Checks that the ranking does not slow task completion. |
| Segment targeting | None; full Development audience. | The experiment is not segment-targeted. Scripted IDs carry the `qa_sim_` prefix; this does not create a Flagsmith segment. |

## Results and verdict

`/api/analytics` reads the documented Flagsmith experiment results, exposures, and configuration endpoints. For a documented result, it renders the per-variant `evaluations`, `conversions`, `conversion_rate`, `chance_to_win`, `statistics.lift` verbatim, `winner`, `recommendation`, and `sample_size_warning`. Flagsmith's lift text is displayed under **lift and interval as Flagsmith reports it**; TerraLens does not calculate a confidence or credible interval. It shows the exposure split from Flagsmith and never uses local SQLite counts as Flagsmith results.

When the results value is null, the page shows the Flagsmith exposure count and says the conversion count is unavailable in the null payload. The exposure response does not contain conversions, so TerraLens does not substitute a warehouse event total or invent a number. When a response does not match the documented `ExperimentResults` shape, the page reports that and does not infer a verdict from the undocumented fields. [Flagsmith Management API Swagger](https://api.flagsmith.com/api/v1/docs/) · [Analyse an Experiment](https://docs.flagsmith.com/experimentation/analyse-an-experiment)

**Run result:** pending the authorized scripted QA run. Replace this line with the generated Flagsmith verdict sentence, verbatim, after reading the refreshed documented payload. The only verdict labels are `winning`, `losing`, and `inconclusive`; a simulated result describes this scripted cohort only and does not establish human operator performance.

## Expected effect: offline synthetic projection only

`npm run benchmark:project` runs an offline model projection. It retains all 25 incidents in both rankings and samples the existing persona rules from a top-12 window, which lets the severity-only persona sometimes select benchmark incidents at severity ranks 6, 8, and 10. The output is labeled **OFFLINE SYNTHETIC PROJECTION** and never calls Flagsmith or the app API.

| Synthetic persona mix | Projected severity-only mean capture | Projected spatial-impact mean capture | Projected difference | Projection sample target per arm |
|---|---:|---:|---:|---:|
| Baseline: 35% top-rank, 25% infrastructure, 20% population, 15% imperfect, 5% delayed | 0.6777 | 0.9754 | +0.2976 (Cohen's d 1.62) | 53 enrolled |
| Sensitivity: 60% top-rank, 15% infrastructure, 5% population, 15% imperfect, 5% delayed | 0.6064 | 0.9600 | +0.3535 (Cohen's d 2.069) | 53 enrolled |

These are expected effects from synthetic persona choices, not Flagsmith measurements, observed sessions, forecasts of human behavior, or a power guarantee. The 53-per-arm projection target includes the 50-identity reporting floor and a 5% delayed-session allowance. The authorized run target is 100 scripted QA sessions per arm.

## Limitations

- The 25 incidents, locations, and consequence context are synthetic; consequence capture is a prototype proxy, not a calibrated emergency-impact measure.
- The scripted personas and their incident selections are synthetic. This cohort cannot establish how human emergency operators would rank incidents. Human behavior would require a separately recruited, consented operator study and must be reported separately from experiment 581's scripted result.
- Flagsmith returns experiment-wide aggregates. Earlier setup QA exposures on experiment 581 are part of those aggregates; the API does not separate them from the new `qa_sim_` scripted cohort. No human operator data is intentionally sent by the authorized scripted run.
- `incident_prioritization_model_config` and `incident_consequence_fallback_enabled` are absent from the live project; the documented defaults above are used.
- The app keeps local task state in SQLite as a fallback. SQLite is not the experiment-results source.

## Environment variables

Copy `.env.example` to `.env.local`. The example contains no credentials. Values marked private stay local and must never be committed.

| Variable | Required | Origin and use |
|---|---|---|
| `NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY` | Yes | Flagsmith Development client environment key from the environment settings; used by the browser SDK. |
| `FLAGSMITH_SERVER_KEY` | Yes for server evaluation and simulation | Flagsmith Development server environment key from the environment settings; used by the server SDK and run-config signature. Private. |
| `FLAGSMITH_MASTER_API_KEY` | Yes for analytics | Organisation Management API key from Flagsmith; reads experiment results, exposures, and warehouse state. Private. |
| `FLAGSMITH_EXPERIMENT_ID` | Yes | Experiment page/URL ID; set to `581`. |
| `NEXT_PUBLIC_FLAGSMITH_PROJECT_ID` | Yes for dashboard link | Project URL ID; set to `55892`. |
| `NEXT_PUBLIC_FLAG_STRATEGY` | Optional | Strategy feature key override; default `incident_prioritization_strategy`. |
| `NEXT_PUBLIC_FLAG_MODEL_CONFIG` | Optional | Remote model config feature key override; default `incident_prioritization_model_config`. |
| `NEXT_PUBLIC_FLAG_CONSEQUENCE_FALLBACK` | Optional | Boolean fallback feature key override; default `incident_consequence_fallback_enabled`. |
| `NEXT_PUBLIC_METRIC_TASK_SUBMITTED` | Optional | Primary event override; default `priority_task_submitted`. |
| `NEXT_PUBLIC_METRIC_TASK_SUCCESS` | Optional | Secondary event override; default `priority_task_success`. |
| `NEXT_PUBLIC_METRIC_TASK_DURATION` | Optional | Guardrail event override; default `task_duration_seconds`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Supabase project API URL from Project Settings → API; enables remote session persistence with its keys. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | Supabase public anon key from Project Settings → API. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Supabase private service-role key from Project Settings → API. Private. |
| `ADMIN_AUDIT_SECRET` | Optional | Generate locally for the separate protected benchmark-audit endpoint. Private; not needed for the experiment demo. |

`.env.local` is ignored by Git. Never put server or Management API keys in a `NEXT_PUBLIC_*` variable. No key belongs in a commit.

## Demo

See [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for the 2:30 sequence. Every traffic/result statement must say **scripted QA operators, simulated**. Show the Flagsmith dashboard refresh and the returned interval text; if Flagsmith has not computed the result, say so.
