/**
 * TerraLens Strict Server-Clock Timer Boundary Verifier
 *
 * Simulates exact server-clock timing by injecting session records where:
 * started_at is exactly (Now - TargetDuration) relative to server evaluation time.
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';
const DB_PATH = path.join(__dirname, '..', '.data', 'terralens_local.db');

const TARGETS = [
  { label: '119s',   duration: 119.0, expectStatus: 200, expectDeadline: true  },
  { label: '119.9s', duration: 119.9, expectStatus: 200, expectDeadline: true  },
  { label: '120s',   duration: 120.0, expectStatus: 200, expectDeadline: true  },
  { label: '120.1s', duration: 120.1, expectStatus: 200, expectDeadline: false },
  { label: '125s',   duration: 125.0, expectStatus: 200, expectDeadline: false },
  { label: '127.9s', duration: 127.9, expectStatus: 200, expectDeadline: false },
  { label: '128s',   duration: 128.0, expectStatus: 200, expectDeadline: false },
  { label: '128.1s', duration: 128.1, expectStatus: 408, expectDeadline: null  },
];

async function testTimer() {
  console.log('\n======================================================');
  console.log('   Strict Timer Boundary Test (8 Specific Boundaries) ');
  console.log('======================================================\n');

  const results = [];

  for (const t of TARGETS) {
    const participantId = `timer_strict_${t.label.replace('.', '_')}_${Date.now()}`;
    const db = new DatabaseSync(DB_PATH);

    // Insert session directly with started_at computed dynamically relative to submission moment
    const submissionStartTime = Date.now();
    // Offset by target duration in ms
    const startedAt = new Date(submissionStartTime - (t.duration * 1000)).toISOString();

    db.prepare(`
      INSERT INTO local_sessions (
        participant_id, scenario_id, id, variant, started_at, assignment_source, flagsmith_exposure_recorded
      ) VALUES (?, 'city_a', ?, 'severity_only', ?, 'flagsmith_remote', 1)
    `).run(participantId, participantId, startedAt);
    db.close();

    // Call submit immediately (<1ms)
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
      targetDuration: t.duration,
      measuredDuration,
      status,
      expectStatus: t.expectStatus,
      deadline,
      expectDeadline: t.expectDeadline,
      passed: pass,
    });

    console.log(
      `Boundary [${t.label.padEnd(6)}]: Status=${status} (exp ${t.expectStatus}), ` +
      `Duration=${measuredDuration}s, ` +
      `within_standard_deadline=${deadline} (exp ${t.expectDeadline}) -> ${pass ? 'PASS' : 'FAIL'}`
    );

    // Cleanup
    const cleanupDb = new DatabaseSync(DB_PATH);
    cleanupDb.prepare('DELETE FROM local_sessions WHERE participant_id = ?').run(participantId);
    cleanupDb.close();
  }

  console.log('\n--- Final Summary Table ---');
  console.table(results);
  return results;
}

testTimer().catch(console.error);
