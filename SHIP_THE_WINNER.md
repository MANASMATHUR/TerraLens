# Ship the experiment result

TerraLens does not declare a winner from SQLite or simulated traffic. Use the Flagsmith experiment result and verify split health before changing the flag. The live experiment is TerraLens project `55892`, Development environment, experiment `581`.

## If one variation wins

1. In Flagsmith, open the TerraLens project, the experiment environment, and the `incident_prioritization_strategy` experiment.
2. Refresh results. Do not refresh more than once every five minutes.
3. Confirm the result is conclusive and the sample-ratio-mismatch health check is clear. Record the native metric values and the `statistics.lift` text exactly as Flagsmith reports it. Do not calculate a separate interval in TerraLens.
4. Select **End Experiment**. Flagsmith freezes the result and unlocks the flag.
5. Open the `incident_prioritization_strategy` feature flag in the same environment.
6. Set the flag’s default value to the winning variation (`severity_only` or `spatial_impact`) and its allocation to 100%. Save and publish the flag change.
7. Open `/task` in a fresh browser profile and confirm the rendered variant matches the chosen winner. Open `/flags/health` and confirm Flagsmith answered.

## If the result is inconclusive

1. Open the same experiment and inspect the result and split-health warning.
2. Select **End Experiment** to freeze the inconclusive result and unlock the flag.
3. Open the same `incident_prioritization_strategy` feature flag.
4. Set its default value to `severity_only` and its allocation to 100%. Save and publish. This leaves the operator queue on the established control while the team decides whether to collect more evidence or stop the test.
5. Do not describe either variation as a winner. Report `inconclusive`. If Flagsmith returns `results: null`, show the exposure counts and say no result or interval has been computed.

Flagsmith can show “Collecting data” while an arm has fewer than 50 identities (or fewer than five conversions for an occurrence metric). Follow the live experiment page’s state rather than extrapolating from the simulator.
