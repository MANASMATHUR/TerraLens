# TerraLens demo script — 2:30

Record the app and the signed-in Flagsmith dashboard. Keep credentials masked. The cohort label in narration and on screen is always **scripted QA operators, simulated**. All incident data and persona choices are synthetic; do not present this as human operator behavior.

| Time | Length | Shot and narration |
|---|---:|---|
| 0:00–0:15 | 15 sec | **Problem.** Show the incident queue and map. Say: “Our hypothesis is that spatial consequence raises mean consequence capture for scripted QA operators, simulated, compared with severity-only ranking.” State that the Jaipur incidents are synthetic. |
| 0:15–1:00 | 45 sec | **Simulated task.** Show one `qa_sim_` run line beside the task queue: Flagsmith-assigned arm, persona, three selected incident IDs, and submission response. Say explicitly: “This is a scripted QA operator, simulated; the choices are synthetic and are not a human task observation.” Do not show a real-person task as part of this cohort. |
| 1:00–1:40 | 40 sec | **Flagsmith dashboard.** Show TerraLens → Development → experiment 581. Refresh the dashboard. Point out `incident_prioritization_strategy`, Control=`severity_only`, Variant_1=`spatial_impact`, 50/50 allocation, and per-arm exposures. Read `evaluations`, `conversions`, `conversion_rate`, and `chance_to_win` from the refreshed payload; show `statistics.lift` verbatim under “lift and interval as Flagsmith reports it”. |
| 1:40–2:10 | 30 sec | **Honest verdict.** Read the one generated sentence verbatim from `/analytics` and this README Results section. Use exactly one verdict label: `winning`, `losing`, or `inconclusive`. State the simulated-cohort limitation. If the result is null or its schema is undocumented, say Flagsmith has not computed a documented result; do not infer a verdict from local data. |
| 2:10–2:30 | 20 sec | **Shipping.** Show [SHIP_THE_WINNER.md](SHIP_THE_WINNER.md). Explain the documented Flagsmith UI steps to set the verified winning strategy to 100%; if inconclusive, end with `severity_only` at 100%. Do not flip the live flag while recording. |

The five segments total exactly 2:30. Replace the run-line example and verdict with actual Flagsmith values only after refreshing the experiment dashboard. Never describe scripted QA counts as measured human behavior.
