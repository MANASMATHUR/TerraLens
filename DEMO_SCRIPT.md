# TerraLens: 175-Second Demo Blueprint

> **Track:** WeMakeDevs × Flagsmith Toggle Wars — Track 01: Test Something Real ($2,000)  
> **Target Duration:** 2 minutes 50 seconds (170s target, 180s hard limit)  
> **Speaker Audio Tone:** Precise, objective, engineering-focused. No hype, no unverified claims.

---

## Timed Scene-by-Scene Breakdown

### Beat 1: The Operational Problem (00:00 – 00:20 | 20s)
* **Visual:** Browser showing Jaipur GIS map in TerraLens (`http://localhost:3000`). Layers toggle on: population heatmap, trauma hospital buffer zones, road accessibility vectors.
* **Audio:**
  > "In municipal emergency operations, infrastructure incidents are traditionally prioritized by engineering severity alone. But a transformer blowout next to a major trauma center presents vastly more physical disruption risk than one in an empty field. TerraLens tests whether embedding real-time spatial context into incident ranking improves high-consequence decision making."

### Beat 2: Flagsmith-Driven Incident Triage (00:20 – 01:05 | 45s)
* **Visual:** Operator navigates to `/task`. Show the experiment governance banner: *Experiment 581 · Variant: spatial_impact · Remotely Verified*. Operator reviews the 25 live Jaipur incidents, inspects an incident via "Why This Incident" modal showing population and hospital accessibility scores, selects top 3, and submits. Show the completed submission modal.
* **Audio:**
  > "Everything is controlled by Flagsmith. When an operator loads the task, Flagsmith initializes identity assignment before rendering. Under the treatment arm, Flagsmith injects dynamic spatial scoring weights remotely. The operator evaluates the incidents and submits within the two-minute window. Ground-truth consequence models remain strictly server-isolated."

### Beat 3: The Experiment Dashboard in Flagsmith (01:05 – 01:45 | 40s)
* **Visual:** Switch browser tab to Flagsmith Management Dashboard for Project 55892 (TerraLens) -> Environment: Development -> Experiment 581 ("TerraLens: Spatial Impact vs Severity"). Show 50/50 allocation between `severity_only` and `spatial_impact`. Point out the three metrics: `priority_task_submitted` (Mean), `priority_task_success` (Occurrence), and `task_duration_seconds` (Mean).
* **Audio:**
  > "Here is Experiment 581 running in Flagsmith's Development environment. The multivariate flag splits traffic 50/50. We track three server-governed metrics: consequence capture as our primary mean metric, binary benchmark match as an occurrence metric, and elapsed task duration as a guardrail. All telemetry streams directly to Flagsmith's warehouse."

### Beat 4: Honest Result Reporting & Cohort Reconciliation (01:45 – 02:25 | 40s)
* **Visual:** Switch to TerraLens `/analytics` page. Point to the Reconciled Experiment Cohort Table and live Flagsmith metric cards.
* **Audio:**
  > "To evaluate this at scale, we ran a scripted QA cohort of simulated operators. Across 83 evaluated sessions in Flagsmith's warehouse, the primary graded metric moved from 0.574 under control to 0.844 under spatial impact. This graded increase confirms ranking fidelity by construction—the spatial engine successfully surfaces high-consequence incidents to the top. In actual incident choices, the binary success rate rose from 14.6% to 26.2%. Because Flagsmith's native Bayesian inference was still computing at submission, we claim no native chance-to-win, and our guardrail duration reflects automated script execution rather than human cognitive load."

### Beat 5: Promote the Winner (02:25 – 02:45 | 20s)
* **Visual:** Switch back to Flagsmith. Show the rollout slider or feature state toggle where `spatial_impact` can be rolled out to 100% of operators with one click.
* **Audio:**
  > "With spatial ranking demonstrably surfacing high-consequence incidents, promoting the treatment arm takes one click in Flagsmith without redeploying code. That is real experimentation in production."

---

## Verbatim Numbers to Speak

| Metric | Spoken Value | Attribution Label |
| :--- | :--- | :--- |
| **Exposures** | 53 Control, 47 Treatment | Flagsmith Exposures API |
| **Evaluated Identities** | 41 Control, 42 Treatment (83 Total) | Flagsmith Warehouse Results API |
| **Primary Metric (`priority_task_submitted`)** | 0.574 Control vs. 0.844 Treatment | Live Flagsmith Dashboard Mean |
| **Occurrence Rate (`priority_task_success`)** | 14.6% Control vs. 26.2% Treatment | Live Flagsmith Conversions |
| **Cohort Type** | "Scripted QA operators, simulated" | Stated explicitly aloud |
| **Inference Status** | "Still computing at submission" | Stated explicitly aloud |
