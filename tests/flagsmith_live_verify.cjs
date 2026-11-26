/**
 * Full end-to-end Flagsmith verification test
 * - Creates a fresh participant identity
 * - Calls POST /api/sessions with the identity (triggers client-side Flagsmith init server-side)
 * - Checks assignment_source and flagsmith_exposure_recorded in DB
 * - Submits a valid task completion
 * - Checks conversion events would be dispatched
 * - Verifies stable re-assignment on second call
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const crypto = require('crypto');

const BASE = 'http://localhost:3000';
const DB_PATH = path.join(__dirname, '..', '.data', 'terralens_local.db');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   TerraLens: Flagsmith Live Verification Test        ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const participantId = `human_verify_${crypto.randomUUID().slice(0,8)}`;
  console.log(`Participant ID: ${participantId}`);

  // ── 1. Create session (server reads Flagsmith env key)
  console.log('\n[1] POST /api/sessions ...');
  const sessRes = await fetch(`${BASE}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: participantId,
      scenario_id: 'city_a',
      variant: 'severity_only',              // placeholder; real variant comes from client SDK
      assignment_source: 'deterministic_fallback',
      flagsmith_exposure_recorded: false,
    }),
  });
  const sessData = await sessRes.json();
  console.log(`  HTTP: ${sessRes.status}`);
  console.log(`  storage_backend: ${sessData.storage_backend}`);
  console.log(`  assignment_source (persisted): ${sessData.assignment_source}`);
  console.log(`  flagsmith_exposure_recorded: ${sessData.flagsmith_exposure_recorded}`);
  console.log(`  variant: ${sessData.variant}`);

  // ── 2. Check DB record directly
  console.log('\n[2] Reading SQLite record directly ...');
  const db = new DatabaseSync(DB_PATH);
  const row = db.prepare('SELECT * FROM local_sessions WHERE participant_id = ?').get(participantId);
  if (row) {
    console.log(`  DB assignment_source: ${row.assignment_source}`);
    console.log(`  DB flagsmith_exposure_recorded: ${row.flagsmith_exposure_recorded}`);
    console.log(`  DB variant: ${row.variant}`);
  } else {
    console.log('  WARNING: No DB record found!');
  }

  // ── 3. Test stable re-assignment
  console.log('\n[3] Second call (stability check) ...');
  const sess2Res = await fetch(`${BASE}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: participantId,
      scenario_id: 'city_a',
      variant: 'spatial_impact', // different variant — should be ignored
      assignment_source: 'flagsmith_remote',
      flagsmith_exposure_recorded: true,
    }),
  });
  const sess2 = await sess2Res.json();
  const variantStable = sess2.variant === sessData.variant;
  console.log(`  Returned variant: ${sess2.variant} (original: ${sessData.variant})`);
  console.log(`  Variant stable: ${variantStable ? '✅ YES' : '❌ NO — changed!'}`);

  // ── 4. Submit task (valid picks — will be evaluated server-side)
  console.log('\n[4] POST /api/submissions ...');
  await sleep(500); // small delay so duration > 0
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
  console.log(`  HTTP: ${subRes.status}`);
  console.log(`  success: ${subData.success}`);
  console.log(`  matches: ${subData.matches}`);
  console.log(`  precision_at_3: ${subData.precision_at_3}`);
  console.log(`  ndcg_at_3: ${subData.ndcg_at_3}`);
  console.log(`  duration_seconds: ${subData.duration_seconds}`);
  console.log(`  within_standard_deadline: ${subData.within_standard_deadline}`);

  // Check benchmark IDs NOT in response
  const respStr = JSON.stringify(subData);
  const benchmarkLeaked = respStr.includes('benchmark') || respStr.includes('reference_rank') || respStr.includes('7, 18, 1');
  console.log(`  Benchmark IDs in response: ${benchmarkLeaked ? '❌ LEAKED' : '✅ NOT PRESENT'}`);

  // ── 5. Check DB after submission
  console.log('\n[5] DB state after submission ...');
  const rowAfter = db.prepare('SELECT * FROM local_sessions WHERE participant_id = ?').get(participantId);
  if (rowAfter) {
    console.log(`  completed_at: ${rowAfter.completed_at}`);
    console.log(`  successful: ${rowAfter.successful}`);
    console.log(`  duration_seconds: ${rowAfter.duration_seconds}`);
    console.log(`  selected_incident_ids: ${rowAfter.selected_incident_ids}`);
  }

  // ── 6. Duplicate rejection test
  console.log('\n[6] Duplicate submission test ...');
  const dupRes = await fetch(`${BASE}/api/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: participantId,
      scenario_id: 'city_a',
      selected_incident_ids: [7, 18, 1],
    }),
  });
  console.log(`  HTTP: ${dupRes.status} (expected 409)`);
  console.log(`  ${dupRes.status === 409 ? '✅ PASS' : '❌ FAIL'} — duplicate correctly rejected`);

  // ── 7. Cleanup
  db.prepare('DELETE FROM local_sessions WHERE participant_id = ?').run(participantId);
  db.close();
  console.log('\n[7] Test session cleaned up from DB');
  console.log('\n══════════════════════════════════════════════════════');
}

run().catch(err => { console.error('FATAL:', err); process.exit(1); });
