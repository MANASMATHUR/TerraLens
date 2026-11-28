# TerraLens — Track 01 Master Strategy & Experimentation Architecture

> **Toggle Wars: The Flagsmith Experimentation Hackathon**  
> **Track:** Track 01 — *Test Something Real*  
> **Core Hypothesis:** *Does spatial intelligence help human operators prioritize emergency municipal infrastructure incidents more accurately than legacy severity-only ranking?*

---

## 1. Executive Summary & Judging Scorecard Alignment

| Judging Criterion | How TerraLens Meets & Exceeds It |
| :--- | :--- |
| **Use of Flagsmith** | **Flagsmith is the engine, not an ornament.** A multivariate flag (`incident_prioritization_strategy`) governs the core user experience (50% Control `severity_only` vs 50% Treatment `spatial_impact`). All exposure events, primary occurrence conversions (`priority_task_success`), and continuous latency metrics (`priority_task_duration_seconds`) are wired through the Flagsmith SDK with unified identity hashing and strict server-side event flushing. |
| **Impact & Realism** | Real-world problem: Municipal crisis triage during urban flooding/monsoons in Jaipur, India. Built with real OpenStreetMap geometries and WorldPop population grids (`EPSG:32643`). Synthetic incidents are explicitly and transparently labeled. |
| **Creativity with Restraint** | Rather than circularly grading users against our own ranking formula, participants are evaluated against an **independent server-side physical disruption benchmark** ($ReferenceImpact$) modeling power grid cascades, hydraulic pressure drops, and trauma facility access. |
| **Experiment Health & Pipeline Integrity** | TerraLens features a dedicated **Experiment Health Dashboard** tracking 8 critical pipeline indicators (Exposures, Parity Allocation, Success Conversions, Failed Attempts, Idempotency/Duplicate Blocks, Event Ingestion, and Identity Consistency). |
| **Demo Clarity** | Crystal-clear 3-minute narrative: the problem &rarr; the competing arms &rarr; live Flagsmith Cloud configuration &rarr; realistic human triage task &rarr; causal lift and statistical health dashboard. |

---

## 2. The Core Experiment: Clean, Unconfounded & Falsifiable

```
                           [Anonymous Participant UUID]
                                        │
                                        ▼
                     [Flagsmith Multivariate Evaluation]
                    (incident_prioritization_strategy)
                                 50% / 50%
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
        [Control Arm (S_A)]                          [Treatment Arm (S_B)]
     Severity-Only Prioritization                 Spatial-Impact Prioritization
        S_A = Raw SCADA Severity                   S_B = Sev * (0.55 + 0.45 * C)
                 │                                             │
                 └──────────────────────┬──────────────────────┘
                                        │
                                        ▼
                       [Identical Operator Experience]
                  • Identical 25 Jaipur GIS Incidents & Map
                  • Identical 120-Second Triage Countdown
                  • Identical "Why This Incident?" Detail Inspector
                  • Participant Selects Top-3 Critical Incidents
                                        │
                                        ▼
                    [Server-Side Independent Benchmark]
               Scored against hidden physical cascade model:
            ReferenceImpact = Disruption * (1 + 0.5 * Facilities)
                                        │
                                        ▼
                 [Strict Server Event Ingestion & Flush]
              1. priority_task_completed
              2. priority_task_success (if matches >= 2 of top 3)
              3. priority_task_duration_seconds (continuous latency)
```

### Eliminating Confounding Variables
1. **Identical Visual Layout:** Both arms receive the exact same 3-column split view (Incident Stream, Center Leaflet GIS Map, and Right Analytical Sidebar).
2. **Identical Datasets & Attributes:** Both arms see the same 25 incidents with identical descriptions, sensor readings, and GIS layers.
3. **Identical Time Constraint:** Both arms enforce a strict 120-second server-clock response window.
4. **The Only Difference:** The **queue order** and the **strategy breakdown** in the "Why This Incident?" inspector reflect their assigned experimental arm.

---

## 3. "Why This Incident?" Explainability Specification

To make the experiment genuinely compelling without introducing confounding variables, participants in both arms can inspect why an incident was positioned in their queue:

### Component Breakdown
- **Incident Header:** ID, Title, Infrastructure Type (`WTR`, `PWR`, `GAS`, `RDW`).
- **1. Technical Equipment Severity:** 0–100 SCADA alarm rating.
- **2. Population in Impact Radius:** Raw resident count from WorldPop with exposure level badge (*High*, *Moderate*, *Low*) and normalized index $P$.
- **3. Adjacent Critical Facilities:** Count of nearby hospitals and fire stations with normalized index $F$.
- **4. Road Network Reachability:** Distance to nearest arterial road network in meters with normalized index $A$.
- **Strategy Comparison Box:** Shows $S_A$ vs $S_B$ side-by-side with transparent rationale:
  - **In Control ($S_A$):** *"Ranked strictly by raw engineering severity (78.0 / 100). Spatial context metrics are provided for operational transparency, but do not alter the queue position."*
  - **In Treatment ($S_B$):** *"Ranked by spatial disruption amplifiers ($S_B = 89.4$). Population exposure and trauma facilities multiplied the baseline engineering severity."*

---

## 4. Internal Experiment Health & Pipeline Monitoring

In addition to calculating statistical outcomes, TerraLens includes an **Internal Health Panel** verifying experimentation infrastructure:

| Health Indicator | What It Verifies | Target / Production Baseline |
| :--- | :--- | :--- |
| **1. Total Exposures** | Users who actually received a variant flag from Flagsmith | 100% of participants entering session |
| **2. Control Allocation** | Statistical distribution of Control participants ($S_A$) | $50.0\% \pm 5\%$ parity |
| **3. Treatment Allocation** | Statistical distribution of Treatment participants ($S_B$) | $50.0\% \pm 5\%$ parity |
| **4. Successful Tasks** | Primary conversion events (`priority_task_success`) | Recorded only when $\ge 2$ benchmark top-3 matched |
| **5. Failed Submissions** | Validation failures, timeouts (>120s), or sub-optimal picks | Real-time counter of non-qualifying sessions |
| **6. Duplicate Attempts** | Submission idempotency & anti-tampering protection | Blocks repeated submissions for same participant UUID |
| **7. Event Ingestion** | Events reaching Flagsmith Cloud API | `HTTP 200` acknowledged & flushed |
| **8. Assignment Consistency** | Users retaining their assigned variant across reload | $100.0\%$ deterministic identity stability |

---

## 5. Automated Experiment Verification Runner

The project includes an automated test traffic runner (`scripts/simulate_traffic.mjs` / `npm run simulate`) conforming to hackathon rules:

```bash
# Run automated verification with 50 synthetic participants
npm run simulate -- --count=50

# Run large-scale verification with 100 synthetic participants
npm run simulate -- --count=100
```

---

## 6. Official 3-Minute Demo Video Script

Refer to the master document for the full verbatim timing and speaking points across Problem, Flagsmith Config, Live Console, Analytics, and Closing.
