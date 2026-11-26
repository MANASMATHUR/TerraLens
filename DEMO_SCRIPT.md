# TerraLens demo script — 2:30

Record the actual app and Flagsmith dashboard. Use a real operator for the task segment. Keep the live experiment at its 50/50 split and mask all credentials. All incident data is synthetic. Do not create simulator sessions or outcome events for the demo.

| Time | Length | Shot and narration |
|---|---:|---|
| 0:00–0:15 | 15 sec | **Problem.** Show the incident queue and map. Say: “Adding spatial consequence to incident ranking increases operators’ mean consequence capture compared with severity-only ranking.” Note that the Jaipur incidents are synthetic. |
| 0:15–1:00 | 45 sec | **Operator task.** Show a real operator reading the 20-second tutorial, starting the timer, comparing severity and context, choosing three incidents, and submitting once. Keep the task continuous; do not replace a real selection with scripted picks. |
| 1:00–1:40 | 40 sec | **Flagsmith dashboard.** Show TerraLens → Development → experiment 581. Point out the `incident_prioritization_strategy` flag, Control=`severity_only`, Variant_1=`spatial_impact`, the 50/50 allocation, primary `priority_task_submitted`, and the attached success and duration metrics. Show per-arm exposures. If Flagsmith has computed a result, show the `statistics.lift` text exactly as returned. If it is still `null`, show that state and say no interval is available yet. |
| 1:40–2:10 | 30 sec | **Honest verdict.** Read the generated verdict exactly: `winning`, `losing`, or `inconclusive`. With the current snapshot, say: “Inconclusive. Flagsmith has not computed a result yet. These two exposures are QA identities, and there are no operator outcome events in the result.” Do not substitute the offline projection. |
| 2:10–2:30 | 20 sec | **Shipping.** Show `SHIP_THE_WINNER.md` and explain the live action: end the experiment only after reviewing a computed result and split health, then set the same flag to the verified winner. With an inconclusive result, keep the control. Do not change the live flag during the recording. |

The five segment lengths total exactly 2:30. If real operator runs produce a Flagsmith result before recording, replace the current empty-state narration with the returned result and interval text; never add simulated values.
