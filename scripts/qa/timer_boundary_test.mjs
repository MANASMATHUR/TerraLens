/**
 * TerraLens Timer Boundary Tests
 * Tests server-side timer classification at key boundaries:
 * 119s, 120s, 120.1s, 125s, 128s, 128.1s
 *
 * Strategy:
 * 1. Create a session via POST /api/sessions (gets a real session_id)
 * 2. Directly manipulate the SQLite DB to backdate started_at
 * 3. Submit via POST /api/submissions
 * 4. Capture HTTP status + within_standard_deadline field
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';
const DB_PATH = path.join(__dirname, '..', '.data', 'terralens_local.db');

// Valid 3-incident selection (correct answer = success)
const CORRECT_PICKS = [7, 18, 1];
// Wrong picks (will be failure, but that's fine - we just care about timer status)
const WRONG_PICKS = [2, 3, 4];

const TEST_CASES = [
  { label: '119s',   elapsedMs: 119000, expectStatus: 200, expectStandardDeadline: true  },
  { label: '120s',   elapsedMs: 120000, expectStatus: 200, expectStandardDeadline: true  },
  { label: '120.1s', elapsedMs: 120100, expectStatus: 200, expectStandardDeadline: false },
  { label: '125s',   elapsedMs: 125000, expectStatus: 200, expectStandardDeadline: false },
  { label: '128s',   elapsedMs: 128000, expectStatus: 200, expectStandardDeadline: false },
  { label: '128.1s', elapsedMs: 128100, expectStatus: 408, expectStandardDeadline: null  },
];

async function createSession() {
  const participantId = `timer_test_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  // /api/sessions requires participant_id AND variant (line 19 of route.ts)
  const res = await fetch(`${BASE}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: participantId,
      scenario_id: 'city_a',
      variant: 'severity_only',
      assignment_source: 'deterministic_fallback',
      flagsmith_exposure_recorded: false,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Session creation failed: ${res.status} ${errText}`);
  }
  const data = await res.json();
  return { participantId, sessionId: data.session_id || participantId };
}

function backdateSession(participantId, elapsedMs) {
  const db = new DatabaseSync(DB_PATH);
  const backdated = new Date(Date.now() - elapsedMs).toISOString();
  db.prepare(
    "UPDATE local_sessions SET started_at = ? WHERE participant_id = ?"
  ).run(backdated, participantId);
  db.close();
  return backdated;
}

async function submitTask(participantId, picks) {
  const res = await fetch(`${BASE}/api/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: participantId,
      scenario_id: 'city_a',
      selected_incident_ids: picks,
    }),
  });
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
}

async function cleanupSession(participantId) {
  try {
    const db = new DatabaseSync(DB_PATH);
    db.prepare("DELETE FROM local_sessions WHERE participant_id = ?").run(participantId);
    db.close();
  } catch {}
}

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║          TerraLens Timer Boundary Test Suite                    ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  const results = [];

  for (const tc of TEST_CASES) {
    process.stdout.write(`Testing ${tc.label}... `);
    let pass = false;
    let actualStatus = null;
    let actualDeadline = null;
    let error = null;
    let participantId = null;
    let backdated = null;

    try {
      // 1. Create session
      const session = await createSession();
      participantId = session.participantId;

      // 2. Backdate started_at
      backdated = backdateSession(participantId, tc.elapsedMs);

      // 3. Submit
      const { status, body } = await submitTask(participantId, CORRECT_PICKS);
      actualStatus = status;
      actualDeadline = body?.within_standard_deadline ?? null;

      // 4. Evaluate
      const statusOk = actualStatus === tc.expectStatus;
      const deadlineOk = tc.expectStandardDeadline === null
        ? true  // 408 responses don't have this field
        : actualDeadline === tc.expectStandardDeadline;

      pass = statusOk && deadlineOk;

      results.push({
        label: tc.label,
        elapsedMs: tc.elapsedMs,
        backdated,
        expectedStatus: tc.expectStatus,
        actualStatus,
        expectedDeadline: tc.expectStandardDeadline,
        actualDeadline,
        pass,
        body: body ? JSON.stringify(body).substring(0, 200) : 'no body',
      });

      console.log(pass ? '✅ PASS' : '❌ FAIL');
      if (!pass) {
        console.log(`   Status: expected=${tc.expectStatus} actual=${actualStatus}`);
        console.log(`   within_standard_deadline: expected=${tc.expectStandardDeadline} actual=${actualDeadline}`);
        console.log(`   Body: ${JSON.stringify(body)?.substring(0, 200)}`);
      } else {
        console.log(`   HTTP ${actualStatus} | within_standard_deadline=${actualDeadline}`);
        if (body?.duration_seconds !== undefined) {
          console.log(`   Server-measured duration: ${body.duration_seconds}s`);
        }
      }
    } catch (err) {
      error = err.message;
      console.log(`💥 ERROR: ${err.message}`);
      results.push({
        label: tc.label,
        elapsedMs: tc.elapsedMs,
        backdated,
        expectedStatus: tc.expectStatus,
        actualStatus: null,
        expectedDeadline: tc.expectStandardDeadline,
        actualDeadline: null,
        pass: false,
        error,
      });
    } finally {
      if (participantId) await cleanupSession(participantId);
    }

    // Small delay between tests
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n──────────────────────────────────────────────────────────────────');
  console.log('SUMMARY TABLE');
  console.log('──────────────────────────────────────────────────────────────────');
  console.log('Elapsed | Exp HTTP | Act HTTP | Exp Deadline | Act Deadline | Pass');
  console.log('--------|----------|----------|--------------|--------------|-----');
  for (const r of results) {
    const dl = r.expectedDeadline === null ? 'N/A (408)' : String(r.expectedDeadline);
    const adl = r.actualDeadline === null ? 'N/A' : String(r.actualDeadline);
    console.log(
      `${r.label.padEnd(7)} | ${String(r.expectedStatus).padEnd(8)} | ${String(r.actualStatus ?? 'ERR').padEnd(8)} | ${dl.padEnd(12)} | ${adl.padEnd(12)} | ${r.pass ? 'PASS' : 'FAIL'}`
    );
  }

  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  console.log(`\nResult: ${passed}/${total} passed`);
  console.log('\n──────────────────────────────────────────────────────────────────');

  // Output JSON for report generation
  console.log('\nJSON_RESULTS_START');
  console.log(JSON.stringify(results, null, 2));
  console.log('JSON_RESULTS_END');

  return results;
}

runTests().catch(console.error);
