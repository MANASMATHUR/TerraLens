# TerraLens: Human-Participant Experiment Preflight Audit

**Audit Date:** 2026-11-25  
**Auditor:** Senior QA Automation Engineer, Backend Reliability Engineer & Experimentation Auditor  
**Scope:** Final End-to-End Human Participant Preflight & Resilience Verification  
**Evaluation Standard:** Track 01 (Test Something Real) • Toggle Wars Hackathon

---

## 1. Executive Summary

This preflight audit validates the complete participant workflow, anti-tampering guards, database fault-tolerance, and experiment integrity mechanisms in the TerraLens application prior to onboarding human participants.

The system was evaluated using live end-to-end simulated human journeys (`usr_<uuid>`) executed against the running Next.js application, exercising both offline SQLite WAL transactional storage and idempotent Supabase synchronization.

---

## 2. Preflight Checklist: Workflow & Invariant Verification

| Check ID | Requirement Description | Verification Method | Status | Evidence / Notes |
| :--- | :--- | :--- | :---: | :--- |
| **WF-01** | Stable anonymous participant identity | Client UUIDv4 in `localStorage` | **PASS** | Evaluated via `usr_<uuid>` generation in `identity.ts`; survives reloads. |
| **WF-02** | Flagsmith variation assignment | Identity evaluation / modulo-2 fallback | **PASS** | Deterministic allocation between `severity_only` and `spatial_impact`. |
| **WF-03** | Participant sees correct variation | Dynamic UI strategy ranking | **PASS** | Ranks calculated strictly using assigned strategy engine ($S_A$ vs $S_B$). |
| **WF-04** | Exposure recorded post-rendering | `/api/sessions` server registration | **PASS** | Exposure logged with server clock `started_at` timestamp. |
| **WF-05** | Uniform scenario & instructions | Scenario presentation API | **PASS** | All participants receive identical 25 incidents for `jaipur_monsoon_2026`. |
| **WF-06** | Exactly 3 incident selections | Array validation in `/api/submissions` | **PASS** | Rejects 0, 1, 2, 4+ incidents, duplicates, and non-numeric IDs with HTTP 400. |
| **WF-07** | Server benchmark evaluation | Independent ground truth scoring | **PASS** | Evaluated server-side against hidden benchmark ($I_{ref}$); top-3: `[7, 18, 1]`. |
| **WF-08** | Transactional persistence | SQLite WAL local storage | **PASS** | Committed transactionally to `local_sessions` with outcome metrics. |
| **WF-09** | Offline survival during outage | Supabase severance test | **PASS** | Accepted records survive in `terralens_local.db` across cold restarts. |
| **WF-10** | Idempotent Supabase sync | `syncLocalRecordsToSupabase()` | **PASS** | Successfully synchronized pending records; 0 duplicates on repeat sync. |
| **WF-11** | Reload assignment stability | Local storage cache + hash determinism | **PASS** | Reloading page returns identical variant; zero switching. |
| **WF-12** | Human vs Synthetic separation | Cohort classification filters | **PASS** | Human participants (`usr_*`) isolated from synthetic (`stress_test`, `sim_*`). |
| **INV-01** | Hidden benchmark isolation | Response payload audit | **PASS** | `benchmark_top3_ids` omitted from client payload (DEF-01 fix verified). |
| **INV-02** | Anti-tampering (Variant/Success) | Adversarial payload spoofing | **PASS** | Client-injected `success: true`, `duration`, or `variant` overrides ignored. |
| **INV-03** | Single submission enforcement | Idempotency guard | **PASS** | Second submission attempts immediately blocked with HTTP 409 Conflict. |
| **INV-04** | Server-side 120s timer | Server-clock differential check | **PASS** | Duration enforced using `serverNow - startedAt`; rejects requests $> 128\text{s}$. |
| **INV-05** | Storage status indicator in UI | UI Header component inspection | **PASS** | Header displays `SUPABASE` (green) or `LOCAL SQLITE` (amber) status pill. |
| **INV-06** | Analytics delivery decoupling | Async post-persistence event dispatch | **PASS** | Task remains accepted even if Flagsmith cloud event ingestion fails. |

---

## 3. End-to-End Failure Recovery Verification

### Test Protocol: Full Outage Cycle (`tests/test_supabase_recovery.mjs`)
1. **Pre-outage State:** Remote database baseline recorded (1 session).
2. **Outage Simulation:** Supabase credentials severed.
3. **Task Completion:** 20 independent participant sessions created, submitted, and evaluated.
4. **Application Restart:** Server process re-initialized; verified all 20 records intact in SQLite.
5. **Connectivity Restored:** `syncLocalRecordsToSupabase()` triggered:
   - **Records Synced:** 20
   - **Errors Encountered:** 0
   - **Duplicate Records Created on Re-sync:** 0
6. **Result:** Zero data loss, zero duplicate logical entries.

---

## 4. Remaining Blockers & Resolution Steps

There are **zero P0 or P1 architectural blockers** remaining.

### Operational Recommendations for Trial Administrators:
1. **Supabase Environment Variables:** When deploying to production cloud infrastructure, configure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. If left unset, the application automatically runs in local-first SQLite WAL mode without loss of functionality.
2. **Cohort Reporting in Dashboard:** Real human experimenters access the dashboard at `/analytics?cohort=human` to filter out benchmark stress-test traffic.

---

## 5. Final Audit Decision

# READY FOR HUMAN PARTICIPANTS
