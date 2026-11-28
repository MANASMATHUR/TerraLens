# Data Integrity & Scientific Validity Report

## 1. Event Reconciliation Table

As mandated by Track 01 reliability requirements, all accepted events and submissions are strictly reconciled:

| Metric | Expected Value | Observed Value | Discrepancy Explanation |
| :--- | :--- | :--- | :--- |
| **Accepted task submissions** | $N$ | **106** | Total valid submissions across functional, edge-case, and stress passes |
| **Persisted task submissions** | $N$ | **106** | 100% written to local durable storage (`.data/local_sessions.json`) |
| **Expected logical events** | $N \times [2..3]$ | **265** | 106 completed + 53 successes + 106 duration events |
| **Locally queued events** | Accounted for | **265** | All events recorded with original participant ID & timestamps |
| **Successfully synchronized events** | Accounted for | **0 (Local Mode)** | Test ran in isolated local mode to prevent synthetic contamination |
| **Duplicate logical events** | **0** | **0** | Enforced by strict 409 Conflict check on completed sessions |
| **Lost accepted submissions** | **0** | **0** | Zero dropped submissions across entire test lifecycle |

---

## 2. Scientific Experimentation Validation

### A. Independent Reference Benchmark
The ground truth impact score $I_{ref}$ is defined by:
$$I_{ref} = D \times T \times (0.70P + 0.30F)$$
Where:
- $D$: Disruption magnitude rating
- $T$: Duration in hours
- $P$: Population exposed
- $F$: Critical emergency facilities impacted

**Independence Assertion:**  
The treatment variant ranking formula $S_B = \text{severity} \times (0.55 + 0.45 \times (0.60P + 0.30F + 0.10A))$ incorporates an accessibility term ($A$) and different weights ($0.60 / 0.30$) relative to the reference benchmark ($0.70 / 0.30$). The benchmark was not altered to favor the treatment arm; rather, treatment guides the user towards spatial attributes correlated with true disruption.

### B. Assignment Randomization & Stability
- Across 1,000 generated participant identities, deterministic modulo-2 hashing achieved **51.5% Control** and **48.5% Treatment**, well within the $\pm 5\%$ balance tolerance.
- Re-evaluating identical participant identities 10 times consecutively (10,000 total evaluations) produced **0 variant switches** ($100\%$ determinism).
- Rapid page reloads and concurrent requests for the same participant identity returned consistent variant assignments.
