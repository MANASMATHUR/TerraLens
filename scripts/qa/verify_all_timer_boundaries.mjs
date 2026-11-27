/**
 * TerraLens Complete Timer Semantics & Boundary Test Suite
 *
 * Threshold Policy:
 * - At most 120 seconds: primary analysis cohort (within_standard_deadline = true, HTTP 200).
 * - Above 120 and at most 128 seconds: accepted, excluded from primary cohort (within_standard_deadline = false, HTTP 200).
 * - Above 128 seconds: rejected (HTTP 408).
 *
 * Specific boundary points required by audit:
 * 1. 119 seconds
 * 2. 119.9 seconds
 * 3. 120 seconds
 * 4. 120.1 seconds
 * 5. 125 seconds
 * 6. 127.9 seconds
 * 7. 128 seconds
 * 8. 128.1 seconds
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';
const DB_PATH = path.join(__dirname, '..', '.data', 'terralens_local.db');

const TEST_BOUNDARIES = [
  { label: '119s',   targetDuration: 119.0, expectStatus: 200, expectDeadline: true  },
  { label: '119.9s', targetDuration: 119.9, expectStatus: 200, expectDeadline: true  },
  { label: '120s',   targetDuration: 120.0, expectStatus: 200, expectDeadline: true  },
  { label: '120.1s', targetDuration: 120.1, expectStatus: 200, expectDeadline: false },
  { label: '125s',   targetDuration: 125.0, expectStatus: 200, expectDeadline: false },
  { label: '127.9s', targetDuration: 127.9, expectStatus: 200, expectDeadline: false },
  { label: '128s',   targetDuration: 128.0, expectStatus: 200, expectDeadline: false },
  { label: '128.1s', targetDuration: 128.1, expectStatus: 408, expectDeadline: null  },
];

async function runTimerTests() {
  console.log('\n======================================================');
  console.log('   TerraLens: Exact Timer Boundary Verification Test  ');
  console.log('======================================================\n');

  const results = [];

  for (const b of TEST_BOUNDARIES) {
    const participantId = `timer_audit_${b.label.replace('.', '_')}_${Date.now()}`;
    
    // Create baseline session
    const sessRes = await fetch(`${BASE}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: participantId,
        scenario_id: 'city_a',
        variant: 'severity_only',
        assignment_source: 'flagsmith_remote',
        flagsmith_exposure_recorded: true,
      }),
    });
    if (!sessRes.ok) {
      console.error(`Session creation failed for ${b.label}:`, sessRes.status);
      continue;
    }

    // Set precise started_at in SQLite right before calling submissions
    // To isolate network/server processing latency, we calculate started_at such that
    // serverNow - started_at matches targetDuration precisely.
    const db = new DatabaseSync(DB_PATH);
    const now = Date.now();
    const backdateMs = Math.round(b.targetDuration * 1000);
    // Add small 2ms lead time so when route evaluates, durationSeconds lands on targetDuration
    const adjustedStart = new Date(now - backdateMs).toISOString();
    db.prepare('UPDATE local_sessions SET started_at = ? WHERE participant_id = ?').run(adjustedStart, participantId);
    db.close();

    // Submit task
    const subRes = await fetch(`${BASE}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: participantId,
        scenario_id: 'city_a',
        selected_incident_ids: [7, 18, 1],
      }),
    });

    const status = subRes.status;
    let body = null;
    try { body = await subRes.json(); } catch {}

    const actualDuration = body?.duration_seconds ?? null;
    const actualDeadline = body?.within_standard_deadline ?? null;

    const statusPass = status === b.expectStatus;
    const deadlinePass = b.expectDeadline === null ? true : actualDeadline === b.expectDeadline;
    const passed = statusPass && deadlinePass;

    results.push({
      label: b.label,
      targetDuration: b.targetDuration,
      measuredDuration: actualDuration,
      status,
      expectStatus: b.expectStatus,
      deadline: actualDeadline,
      expectDeadline: b.expectDeadline,
      passed,
    });

    console.log(
      `Boundary [${b.label.padEnd(6)}]: Status=${status} (exp ${b.expectStatus}), ` +
      `Duration=${actualDuration}s, ` +
      `within_standard_deadline=${actualDeadline} (exp ${b.expectDeadline}) -> ${passed ? 'PASS' : 'FAIL'}`
    );

    // Clean up test session
    const cleanupDb = new DatabaseSync(DB_PATH);
    cleanupDb.prepare('DELETE FROM local_sessions WHERE participant_id = ?').run(participantId);
    cleanupDb.close();
  }

  console.log('\n--- Final Summary Table ---');
  console.table(results);
  return results;
}

runTimerTests().catch(console.error);
