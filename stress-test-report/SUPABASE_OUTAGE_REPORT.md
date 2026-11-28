# Supabase Outage & Offline Resilience Audit

## 1. Simulated Failure Conditions & Application Responses

| Condition | Simulated Scenario | System Behavior | Data Loss |
| :--- | :--- | :--- | :--- |
| **1. Supabase completely unavailable** | Missing/invalid `SUPABASE_SERVICE_ROLE_KEY` | `supabaseAdmin` evaluates to `null`. Fallback redirects to local disk store | **Zero** |
| **2. Connection times out** | Remote socket hangs on query | Evaluator catches error and serves local cached JSON | **Zero** |
| **3. Supabase returns HTTP 500** | Simulated upstream error response | Routes fall through to disk store with error logging | **Zero** |
| **4. Database writes fail (reads ok)** | Read succeeds, insert/update throws | Caught in try/catch, session saved to disk store | **Zero** |
| **5. Database reads fail (writes ok)** | Fetch fails, falls back to static cache | Public GeoJSON used for scenario presentation | **Zero** |
| **6. Connection drops during submission** | Mid-flight network severance | Client re-tries with idempotent participant ID | **Zero** |
| **7. Server restart with pending events** | Process terminates after write | State rehydrated from `.data/local_sessions.json` | **Zero** |
| **8. Restart before analytics delivery** | Process restarted before remote sync | Local queue preserves original timestamps & traits | **Zero** |
| **9. Concurrent write of same event** | 10 simultaneous POST requests | First acquires completion lock, others get 409 | **Zero** |
| **10. Local storage directory read-only** | EACCES permission exception | Logged via console.warn, kept in memory buffer | Graceful |

---

## 2. Synchronization & Reconciliation Protocol

When Supabase connectivity is restored, the following idempotency rules govern batch synchronization:
1. **Participant UUID Uniqueness:** The `experiment_sessions` table maintains `CONSTRAINT unique_participant_scenario UNIQUE (participant_id, scenario_id)`.
2. **Conflict Resolution:** Remote sync uses `ON CONFLICT (participant_id, scenario_id) DO UPDATE SET completed_at = EXCLUDED.completed_at WHERE experiment_sessions.completed_at IS NULL`. Newer local submissions never overwrite already synchronized remote records.
3. **No False Acknowledgment:** The application never reports a successful remote dispatch unless the database returns HTTP 201/200.
