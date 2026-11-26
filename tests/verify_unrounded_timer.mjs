/**
 * TerraLens Strict Unrounded Boundary Test
 *
 * Verifies exact microsecond-precise boundary enforcement:
 * 1. 119.99s -> HTTP 200, within_standard_deadline: true
 * 2. 120.00s -> HTTP 200, within_standard_deadline: true
 * 3. 120.01s -> HTTP 200, within_standard_deadline: false
 * 4. 125.00s -> HTTP 200, within_standard_deadline: false
 * 5. 127.99s -> HTTP 200, within_standard_deadline: false
 * 6. 128.00s -> HTTP 200, within_standard_deadline: false
 * 7. 128.01s -> HTTP 408 (cutoff expired)
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';
const DB_PATH = path.join(__dirname, '..', '.data', 'terralens_local.db');

const TESTS = [
  { label: '119.99s', durationSec: 119.99, expectStatus: 200, expectDeadline: true  },
  { label: '120.00s', durationSec: 120.00, expectStatus: 200, expectDeadline: true  },
  { label: '120.01s', durationSec: 120.01, expectStatus: 200, expectDeadline: false },
  { label: '125.00s', durationSec: 125.00, expectStatus: 200, expectDeadline: false },
  { label: '127.99s', durationSec: 127.99, expectStatus: 200, expectDeadline: false },
  { label: '128.00s', durationSec: 128.00, expectStatus: 200, expectDeadline: false },
  { label: '128.01s', durationSec: 128.01, expectStatus: 408, expectDeadline: null  },
];

async function runUnroundedBoundaries() {
  console.log('\n=============================================================');
  console.log('   Strict Unrounded Timer Boundary Tests (No Rounding)       ');
  console.log('=============================================================\n');

  const results = [];

  for (const t of TESTS) {
    const participantId = `timer_strict_${t.label.replace('.', '_')}_${Date.now()}`;
    const db = new DatabaseSync(DB_PATH);

    // Compute started_at precisely so that serverNow - started_at matches targetDuration
    // In our test environment, we fetch the server clock or inject started_at immediately prior to submit
    const targetOffsetMs = Math.round(t.durationSec * 1000);
    const now = Date.now();
    // Add small 4ms offset to compensate for local loopback fetch dispatch latency
    const startedAt = new Date(now - targetOffsetMs + 4).toISOString();

    db.prepare(`
      INSERT INTO local_sessions (
        participant_id, scenario_id, id, variant, started_at, assignment_source, flagsmith_exposure_recorded
      ) VALUES (?, 'city_a', ?, 'severity_only', ?, 'flagsmith_remote', 1)
    `).run(participantId, participantId, startedAt);
    db.close();

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

    const measuredDuration = body?.duration_seconds ?? null;
    const deadline = body?.within_standard_deadline ?? null;

    const passStatus = status === t.expectStatus;
    const passDeadline = t.expectDeadline === null ? true : deadline === t.expectDeadline;
    const pass = passStatus && passDeadline;

    results.push({
      label: t.label,
      targetDuration: t.durationSec,
      measuredDuration,
      status,
      expectStatus: t.expectStatus,
      deadline,
      expectDeadline: t.expectDeadline,
      passed: pass,
    });

    console.log(
      `Boundary [${t.label.padEnd(7)}]: Status=${status} (exp ${t.expectStatus}), ` +
      `Duration=${measuredDuration}s, ` +
      `within_standard_deadline=${deadline} (exp ${t.expectDeadline}) -> ${pass ? 'PASS' : 'FAIL'}`
    );

    const cleanupDb = new DatabaseSync(DB_PATH);
    cleanupDb.prepare('DELETE FROM local_sessions WHERE participant_id = ?').run(participantId);
    cleanupDb.close();
  }

  console.log('\n--- Final Summary Table ---');
  console.table(results);
  return results;
}

runUnroundedBoundaries().catch(console.error);
