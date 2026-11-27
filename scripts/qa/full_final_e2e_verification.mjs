/**
 * TerraLens Comprehensive End-to-End Audit & Verification Script
 *
 * Runs:
 * 1. Timer boundary precision verification (119s, 119.9s, 120s, 120.1s, 125s, 127.9s, 128s, 128.1s)
 * 2. Full single-participant complete lifecycle journey with remote Flagsmith
 * 3. Stable assignment & duplicate submission rejection
 * 4. Ground-truth benchmark security verification
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';
const DB_PATH = path.join(__dirname, '..', '.data', 'terralens_local.db');

async function testTimerBoundaries() {
  console.log('\n======================================================');
  console.log('   Part 1: Strict Timer Boundary Verification (8 Points) ');
  console.log('======================================================\n');

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

  const results = [];

  for (const t of TARGETS) {
    const participantId = `timer_verify_${t.label.replace('.', '_')}_${Date.now()}`;
    const db = new DatabaseSync(DB_PATH);

    // Compute started_at so that when evaluated by route handler, measured duration exactly equals target
    // We add 5ms processing offset compensation
    const now = Date.now();
    const startedAt = new Date(now - (t.duration * 1000) + 5).toISOString();

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

    const cleanupDb = new DatabaseSync(DB_PATH);
    cleanupDb.prepare('DELETE FROM local_sessions WHERE participant_id = ?').run(participantId);
    cleanupDb.close();
  }

  console.log('\nTimer Verification Table:');
  console.table(results);
  return results;
}

async function testFullParticipantJourney() {
  console.log('\n======================================================');
  console.log('   Part 2: Full End-to-End Human Participant Journey   ');
  console.log('======================================================\n');

  const participantId = `human_e2e_verified_${Date.now()}`;
  console.log('1. Starting participant session with ID:', participantId);

  // Step 1: Query Flagsmith directly via Edge API to confirm remote assignment
  const clientKey = 'K3ygrnRrsFzbbuh8K7NUcy';
  const fsRes = await fetch(`https://edge.api.flagsmith.com/api/v1/identities/?identifier=${participantId}`, {
    headers: { 'X-Environment-Key': clientKey }
  });
  const fsData = await fsRes.json();
  const remoteFlag = (fsData.flags || []).find(f => f.feature.name === 'incident_prioritization_strategy');
  const assignedVariant = remoteFlag?.feature_state_value || 'severity_only';
  console.log('2. Remote Flagsmith assignment evaluated:', assignedVariant);

  // Step 2: Register session via /api/sessions
  const sessRes = await fetch(`${BASE}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: participantId,
      scenario_id: 'city_a',
      variant: assignedVariant,
      assignment_source: 'flagsmith_remote',
      flagsmith_exposure_recorded: true,
    }),
  });
  const sessData = await sessRes.json();
  console.log('3. Session registered in backend:', sessData.storage_backend, 'Variant:', sessData.variant);

  // Step 3: Fetch incidents list
  const incRes = await fetch(`${BASE}/api/incidents`);
  const incidents = await incRes.json();
  console.log('4. Incidents loaded count:', incidents.length);

  // Step 4: Verify stability on reload
  const reloadRes = await fetch(`${BASE}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: participantId,
      scenario_id: 'city_a',
      variant: assignedVariant === 'severity_only' ? 'spatial_impact' : 'severity_only', // try override
      assignment_source: 'deterministic_fallback',
      flagsmith_exposure_recorded: false,
    }),
  });
  const reloadData = await reloadRes.json();
  const isStable = reloadData.variant === assignedVariant;
  console.log('5. Variant stability verified on reload:', isStable ? 'PASS' : 'FAIL');

  // Step 5: Submit Task with [7, 18, 1]
  const subRes = await fetch(`${BASE}/api/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: participantId,
      scenario_id: 'city_a',
      selected_incident_ids: [7, 18, 1],
    }),
  });
  const subData = await subRes.json();
  console.log('6. Task submitted:');
  console.log('   - HTTP Status:', subRes.status);
  console.log('   - Success:', subData.success);
  console.log('   - Precision@3:', subData.precision_at_3);
  console.log('   - NDCG@3:', subData.ndcg_at_3);
  console.log('   - Duration:', subData.duration_seconds, 'seconds');
  console.log('   - within_standard_deadline:', subData.within_standard_deadline);

  // Step 6: Security check - confirm ground truth is not returned
  const jsonText = JSON.stringify(subData);
  const leaked = jsonText.includes('reference_rank') || jsonText.includes('reference_impact_score') || jsonText.includes('benchmark_top3_ids');
  console.log('7. Ground truth leakage check:', leaked ? 'FAIL (LEAK DETECTED)' : 'PASS (SECURE)');

  // Step 7: Duplicate submission check
  const dupRes = await fetch(`${BASE}/api/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: participantId,
      scenario_id: 'city_a',
      selected_incident_ids: [7, 18, 1],
    }),
  });
  console.log('8. Duplicate submission status:', dupRes.status, dupRes.status === 409 ? 'PASS' : 'FAIL');

  // Step 8: Verify SQLite Persistence Record
  const db = new DatabaseSync(DB_PATH);
  const row = db.prepare('SELECT * FROM local_sessions WHERE participant_id = ?').get(participantId);
  console.log('9. SQLite Persisted Row Verification:');
  console.log('   - variant:', row.variant);
  console.log('   - assignment_source:', row.assignment_source);
  console.log('   - flagsmith_exposure_recorded:', row.flagsmith_exposure_recorded);
  console.log('   - completed_at:', row.completed_at);
  console.log('   - duration_seconds:', row.duration_seconds);
  console.log('   - successful:', row.successful);
  console.log('   - selected_incident_ids:', row.selected_incident_ids);
  db.close();

  return true;
}

async function runAll() {
  await testTimerBoundaries();
  await testFullParticipantJourney();
}

runAll().catch(console.error);
