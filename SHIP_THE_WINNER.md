# Ship the experiment result

These steps apply to TerraLens project `55892`, Development environment, experiment `581`. The result describes **scripted QA operators, simulated**. It does not validate human emergency dispatch behavior, so keep any flag change in Development until a separate real-human study supports an operational decision.

## When Flagsmith reports a conclusive winner

1. Open **Flagsmith → TerraLens → Development → Experiments → TerraLens: Spatial Impact vs Severity (581)**.
2. Refresh the experiment results. Respect Flagsmith's refresh limit; do not request a refresh more than once every five minutes.
3. Confirm `/analytics` and the experiment page show the same documented result, the 50/50 assignment, and no unresolved Flagsmith sample-size warning. Read the `statistics.lift` text verbatim. TerraLens does not calculate another interval.
4. Select **End Experiment** on the experiment page and confirm. This freezes the experiment and unlocks the flag.
5. Open **Environments → Development → Features → `incident_prioritization_strategy`**.
6. In the flag's Value settings, set the value to the winner reported by Flagsmith: `spatial_impact` if that arm won, or `severity_only` if Control won. Save the feature value. With the experiment ended, that default value is served to the Development audience.
7. Open `/task` in a fresh browser session and confirm Flagsmith returns the selected value. Check `/flags/health` for a successful flag response.

## If the result is inconclusive

1. Refresh experiment 581 in the Flagsmith dashboard and read the reported `sample_size_warning` and `statistics.lift` text.
2. Select **End Experiment** and confirm to unlock the flag.
3. Open **Environments → Development → Features → `incident_prioritization_strategy`**.
4. In Value settings, set the value to `severity_only` and save. The Development audience stays on the control arm while the team decides whether to gather more evidence.
5. Keep the verdict `inconclusive`. If the results value is null, report the Flagsmith exposure count and say the conversion count and interval are not available in that payload. Do not extend the run beyond the authorized 100 scripted QA sessions per arm.

Flagsmith's Management API and dashboard are the experiment-result source. Do not use SQLite, simulator logs, or offline projections as experiment results. See [Run an Experiment](https://docs.flagsmith.com/experimentation/run-an-experiment) and [Analyse an Experiment](https://docs.flagsmith.com/experimentation/analyse-an-experiment).
