# Failures and Fixes Log

This document tracks all identified architectural defects, vulnerability ratings, code diffs, and verification steps applied during the Track 01 audit.

---

## 1. Summary of Identified Defects

| Defect ID | Severity | Component | Summary | Status |
| :--- | :--- | :--- | :--- | :--- |
| **DEF-01** | **P0 (Critical)** | `app/api/submissions/route.ts` | Ground truth `benchmark_top3_ids` leaked in client response | **RESOLVED** |
| **DEF-02** | **P1 (High)** | `lib/experiment/session-store.ts` | Local persistence fallback purely in-memory (lost on restart) | **RESOLVED** |
| **DEF-03** | **P1 (High)** | `app/api/analytics/route.ts` | Hardcoded fake data fallback returned if DB was empty | **RESOLVED** |
| **DEF-04** | **P2 (Medium)** | `app/api/sessions/route.ts` | Arbitrary unvalidated variant strings accepted by session API | **RESOLVED** |

---

## 2. Detailed Technical Fixes

### DEF-01 [P0]: Benchmark Ground Truth Leakage in Submission Response
- **Vulnerability:** The submission endpoint originally returned `benchmark_top3_ids: [7, 18, 1]` in the JSON response payload. Any participant inspecting their browser DevTools network tab could read the hidden reference benchmark and achieve 100% precision on repeat runs.
- **Remediation:** Removed `benchmark_top3_ids` from `responsePayload` in `app/api/submissions/route.ts` and updated the `SubmissionResult` interface in `types/index.ts` to make the field optional/deprecated.
- **Verification:** Verified via `TC-07` and `TC-43`. The test suite confirms the field is absent from network payloads.

### DEF-02 [P1]: In-Memory Volatility of Local Persistence Fallback
- **Vulnerability:** `lib/experiment/session-store.ts` held session state, variant consistency sets, and duplicate counters in volatile JavaScript `Map` structures. A container restart or Next.js server reload during a Supabase outage resulted in total loss of un-synchronized participant submissions.
- **Remediation:** Enhanced `lib/experiment/session-store.ts` with synchronous atomic JSON file persistence (`.data/local_sessions.json` and `.data/local_metrics.json`). On module initialization, the store rehydrates state from disk before serving API requests.
- **Verification:** Verified via test suite restarts. Sessions remain durable on disk across process lifecycles.

### DEF-03 [P1]: Deceptive Baseline Analytics Data Fallback
- **Vulnerability:** When no database records existed, `/api/analytics` returned a static mockup dataset containing 50 participants with 32% control and 68% treatment success rates. While intended as a UI placeholder, this presented synthetic data as real human telemetry.
- **Remediation:** Replaced the mockup fallback with a clean zeroed baseline (`total_participants: 0`, rates at `0.0%`, event counts at `0`).
- **Verification:** Verified via test suite `S6_ANALYTICS`. Clean empty states are reported accurately until authentic sessions are recorded.

### DEF-04 [P2]: Unchecked Variant Input in Session Creation
- **Vulnerability:** `POST /api/sessions` validated that `variant` was truthy, but did not assert membership in the allowed experiment arms (`'severity_only' \| 'spatial_impact'`). An attacker could forge invalid arm names (e.g. `'god_mode'`), corrupting cohort analytics.
- **Remediation:** Added strict enum validation in `app/api/sessions/route.ts` returning HTTP 400 Bad Request if the variant is not one of the two permitted strings.
- **Verification:** Verified via `TC-15` in `tests/terralens-stress-test.mjs`. Injected arbitrary strings now return HTTP 400.
