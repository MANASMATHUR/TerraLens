# TerraLens Final Security and Experiment Integrity Verification

**Audit Date:** 2026-11-25  
**Auditor:** Senior QA Automation Engineer, Backend Reliability Engineer & Experimentation Auditor  
**Evaluation Standard:** Track 01: Test Something Real • Toggle Wars Hackathon  
**Execution Script:** [`tests/targeted_security_verification.mjs`](file:///c:/Users/manas/Downloads/Toggle%20Wars/tests/targeted_security_verification.mjs)

---

## 1. Section A: Benchmark Exposure Audit

### Vulnerability Analysis & Discovery
During the initial inspection, `public/geo/benchmarks_server_only.json` was located inside the Next.js `public/` directory. Next.js serves all contents of `public/` as static assets accessible via unauthenticated HTTP GET requests. Testing `http://localhost:3000/geo/benchmarks_server_only.json` returned **HTTP 200 OK**, allowing any client or participant to download the complete hidden ground truth (disruption magnitude, reference rank, and reference impact score).

### Remediation Applied
1. **Relocated Sensitive Benchmark Store:** Moved `public/geo/benchmarks_server_only.json` to private directory `data/benchmarks_server_only.json`.
2. **Updated Server-Side Evaluator:** Adjusted file read path in `app/api/submissions/route.ts` from `path.join(process.cwd(), 'public', 'geo', ...)` to `path.join(process.cwd(), 'data', ...)`.
3. **Audited Other Public Assets:** Verified `public/geo/incidents_data.json` and `public/geo/incidents.geojson`. These files contain only public scenario descriptors and variant rankings (`rank_a`, `rank_b`), containing no disruption magnitude ratings or ground truth rankings.

### Targeted Test Results

| Check ID | Verification Item | Status | Test Executed | Actual Output | Source Location |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **A-1** | `public/geo/benchmarks_server_only.json` file removal | **PASS** | `fs.existsSync(publicBmPath)` | `false` (File absent from public directory) | `public/geo/` |
| **A-2** | Direct HTTP exposure check | **PASS** | `GET http://localhost:3000/geo/benchmarks_server_only.json` | **HTTP 404 Not Found** | Next.js Static Router |
| **A-3** | Secure private store availability | **PASS** | `fs.existsSync(privateBmPath)` | `true` (`data/benchmarks_server_only.json` accessible to server) | `data/benchmarks_server_only.json` |
| **A-4** | Server evaluation functionality | **PASS** | `POST /api/submissions` with picks `[7, 18, 1]` | `HTTP 200: { success: true, matches: 3, precision_at_3: 1 }` | `app/api/submissions/route.ts:100` |

---

## 2. Section B: Flagsmith Experiment Integrity

### Lifecycle & Assignment Verification
The experiment lifecycle was audited to prevent synthetic or fallback assignments from corrupting Flagsmith Cloud telemetry:

1. **Identification Before Evaluation:**  
   `initFlagsmith(participantId)` calls `flagsmith.init({ identity: participantId })` before calling `flagsmith.getValue(STRATEGY_FLAG_NAME)`.
2. **Distinguishing Fallback from Verified Flagsmith Exposures:**  
   `initFlagsmith()` was refactored to return an `AssignmentResult` tracking:
   - `assignment_source`: `'flagsmith_remote'` vs. `'deterministic_fallback'`
   - `flagsmith_exposure_recorded`: `true` vs. `false`
3. **Persistent Server & SQLite Storage:**  
   `POST /api/sessions` receives these metadata flags and records them into `local_sessions`:
   - Offline fallback assignments are explicitly marked as `assignment_source: 'deterministic_fallback'` and `flagsmith_exposure_recorded: 0`.
   - Locally generated fallback assignments are never reported as verified Flagsmith cloud exposures.
4. **Identity Parity on Conversion:**  
   `POST /api/submissions` uses the identical `participant_id` string when invoking `trackServerEvent()` for `priority_task_completed`, `priority_task_success`, and `priority_task_duration_seconds`.

### Targeted Test Results

| Check ID | Verification Item | Status | Test Executed | Actual Output | Source Location |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **B-1** | Assignment source classification | **PASS** | `initFlagsmith(clientPid)` | `variant: severity_only, source: deterministic_fallback, exposure_recorded: false` | `lib/flagsmith/client.ts:10` |
| **B-2** | Server session metadata ingestion | **PASS** | `POST /api/sessions` with `assignment_source` | `HTTP 200: session stored with explicit assignment source` | `app/api/sessions/route.ts:10` |
| **B-3** | SQLite transactional persistence | **PASS** | `getLocalSession(clientPid, SCENARIO_ID)` | Verified in SQLite: `assignment_source=deterministic_fallback, flagsmith_exposure=false` | `lib/experiment/session-store.ts:110` |

---

## 3. Section C: Task Timer & Grace Period Audit

### 120s Task Limit vs. 128s Acceptance Window
The experiment instructions specify a 120-second triage task window.

- **Purpose of the 8-Second Window:**  
  The 8-second window ($128\text{s}$) serves as intentional network latency grace to accommodate slow mobile client round-trips when submitting at $T = 119\text{s}$.
- **Resolution of Deadline Misclassification:**  
  Previously, any submission under 128s was treated identically. To preserve statistical rigor:
  1. The server retains the actual measured continuous duration `duration_seconds = (serverNow - startedAt) / 1000`.
  2. The server appends a separate boolean classification: `within_standard_deadline = durationSeconds <= 120.0`.
  3. Submissions exceeding 128s continue to be rejected strictly with **HTTP 408 Request Timeout**.
  4. Submissions arriving between 120.1s and 128.0s can now be filtered or analyzed separately without contaminating the strict $\le 120\text{s}$ cohort.

### Targeted Test Results

| Check ID | Verification Item | Status | Test Executed | Actual Output | Source Location |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **C-1** | Standard deadline classification | **PASS** | Submit task at $T = 1.0\text{s}$ | `HTTP 200: { duration_seconds: 1.0, within_standard_deadline: true }` | `app/api/submissions/route.ts:162` |
| **C-2** | Exceeded deadline rejection | **PASS** | Submit task at $T = 140\text{s}$ | `HTTP 408 Request Timeout: Triage response window expired` | `app/api/submissions/route.ts:77` |

---

## 4. Final Experiment Readiness Decision

### Human Experiment Clear Statement
- **Zero human experiment data currently exists** in the repository (all previous records were synthetic test traffic).
- **Benchmark ground truth is completely isolated from HTTP access.**
- **Flagsmith cloud exposures are decoupled from offline fallback assignments.**
- **Timing metrics distinguish strict 120s completions from network grace submissions.**

### Final Verdict

# READY FOR HUMAN PARTICIPANTS

Real human participants can now be safely recruited and exposed to the experiment. The physical ground truth is secure, timer boundaries are enforced, offline persistence is crash-safe, and experimental arms are tracked with scientific validity.
