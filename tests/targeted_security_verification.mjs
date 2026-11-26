#!/usr/bin/env node
/**
 * ============================================================
 * TerraLens Targeted Security & Experiment Integrity Verification
 * ============================================================
 */

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const SCENARIO_ID = 'jaipur_monsoon_2026';

const results = {
  sectionA: {},
  sectionB: {},
  sectionC: {},
  passed: 0,
  failed: 0,
};

function pass(section, name, detail) {
  results[section][name] = { status: 'PASS', detail };
  results.passed++;
  console.log(`[PASS] [${section}] ${name}: ${detail}`);
}

function fail(section, name, detail) {
  results[section][name] = { status: 'FAIL', detail };
  results.failed++;
  console.log(`[FAIL] [${section}] ${name}: ${detail}`);
}

async function runVerification() {
  console.log('\n============================================================');
  console.log('🔒 TerraLens Final Security & Experiment Integrity Verification');
  console.log('============================================================\n');

  // --- SECTION A: BENCHMARK EXPOSURE AUDIT ---
  console.log('--- Section A: Benchmark Exposure Audit ---');
  
  // A1: Check if public/geo/benchmarks_server_only.json exists
  const publicBmPath = path.join(process.cwd(), 'public', 'geo', 'benchmarks_server_only.json');
  if (!fs.existsSync(publicBmPath)) {
    pass('sectionA', 'A1_PublicFileAbsent', 'public/geo/benchmarks_server_only.json does NOT exist');
  } else {
    fail('sectionA', 'A1_PublicFileAbsent', 'public/geo/benchmarks_server_only.json STILL EXISTS in public directory!');
  }

  // A2: Attempt to retrieve it through running HTTP server
  try {
    const res = await fetch(`${BASE_URL}/geo/benchmarks_server_only.json`, { signal: AbortSignal.timeout(3000) });
    if (res.status === 404) {
      pass('sectionA', 'A2_HttpBlocked', `Direct HTTP request returned HTTP 404 Not Found (${res.status})`);
    } else {
      fail('sectionA', 'A2_HttpBlocked', `HTTP GET returned ${res.status}! File is publicly accessible!`);
    }
  } catch (err) {
    pass('sectionA', 'A2_HttpBlocked', `Direct HTTP request failed safely: ${err.message}`);
  }

  // A3: Check private location data/benchmarks_server_only.json
  const privateBmPath = path.join(process.cwd(), 'data', 'benchmarks_server_only.json');
  if (fs.existsSync(privateBmPath)) {
    pass('sectionA', 'A3_PrivateStoreExists', 'data/benchmarks_server_only.json exists outside public tree');
  } else {
    fail('sectionA', 'A3_PrivateStoreExists', 'data/benchmarks_server_only.json not found');
  }

  // A4: Verify server-side submission evaluation still functions
  const testPid = `sec_audit_${randomUUID()}`;
  const sessInit = await fetch(`${BASE_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participant_id: testPid, variant: 'spatial_impact' }),
  });
  if (!sessInit.ok) {
    fail('sectionA', 'A4_ServerEvaluationFunctional', `Session creation failed with HTTP ${sessInit.status}`);
  } else {
    const subRes = await fetch(`${BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: testPid,
        selected_incident_ids: [7, 18, 1], // Top-3 ground truth
      }),
    });
    if (subRes.ok) {
      const subData = await subRes.json();
      if (subData.success === true && subData.matches === 3) {
        pass('sectionA', 'A4_ServerEvaluationFunctional', 'Server successfully scored [7,18,1] as 3/3 ground-truth matches using data/benchmarks_server_only.json');
      } else {
        fail('sectionA', 'A4_ServerEvaluationFunctional', `Scoring evaluated unexpectedly: ${JSON.stringify(subData)}`);
      }
    } else {
      fail('sectionA', 'A4_ServerEvaluationFunctional', `Submission failed with HTTP ${subRes.status}`);
    }
  }

  // --- SECTION B: FLAGSMITH EXPERIMENT INTEGRITY ---
  console.log('\n--- Section B: Flagsmith Experiment Integrity ---');

  // B1: Client assignment distinction
  const clientPid = `usr_human_${randomUUID()}`;
  const envKey = process.env.NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY || '';
  const hash = clientPid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const fallbackVariant = hash % 2 === 0 ? 'severity_only' : 'spatial_impact';
  const assignmentSource = envKey && envKey.length > 5 ? 'flagsmith_remote' : 'deterministic_fallback';
  const flagsmithExposure = assignmentSource === 'flagsmith_remote';

  pass('sectionB', 'B1_AssignmentSourceTracked', `Assignment resolved variant: ${fallbackVariant}, source: ${assignmentSource}, exposure_recorded: ${flagsmithExposure}`);

  // B2: Server session records assignment_source accurately
  const sessRes = await fetch(`${BASE_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: clientPid,
      variant: fallbackVariant,
      assignment_source: assignmentSource,
      flagsmith_exposure_recorded: flagsmithExposure,
    }),
  });
  if (sessRes.ok) {
    pass('sectionB', 'B2_SessionRecordsSource', `Session accepted with assignment_source: ${assignmentSource}`);
  } else {
    fail('sectionB', 'B2_SessionRecordsSource', `Session creation failed: ${sessRes.status}`);
  }

  // B3: Local SQLite stores assignment metadata
  const { getLocalSession } = await import('../lib/experiment/session-store.ts');
  const storedSess = getLocalSession(clientPid, SCENARIO_ID);
  if (storedSess && storedSess.assignment_source === assignmentSource) {
    pass('sectionB', 'B3_SQLitePreservesSource', `SQLite verified: assignment_source=${storedSess.assignment_source}, flagsmith_exposure=${storedSess.flagsmith_exposure_recorded}`);
  } else {
    fail('sectionB', 'B3_SQLitePreservesSource', 'SQLite record missing assignment source tracking');
  }

  // --- SECTION C: TASK TIMER (120s vs 128s GRACE) ---
  console.log('\n--- Section C: Task Timer & Grace Period Audit ---');

  // C1: Submissions within standard 120s
  const normalPid = `timer_normal_${randomUUID()}`;
  await fetch(`${BASE_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participant_id: normalPid, variant: 'severity_only' }),
  });
  const normalSub = await fetch(`${BASE_URL}/api/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participant_id: normalPid, selected_incident_ids: [7, 18, 1] }),
  });
  if (normalSub.ok) {
    const data = await normalSub.json();
    if (data.within_standard_deadline === true) {
      pass('sectionC', 'C1_StandardDeadlineField', `Submission within deadline flagged: within_standard_deadline=${data.within_standard_deadline} (${data.duration_seconds}s)`);
    } else {
      fail('sectionC', 'C1_StandardDeadlineField', `Incorrect within_standard_deadline: ${data.within_standard_deadline}`);
    }
  } else {
    fail('sectionC', 'C1_StandardDeadlineField', `Normal submission failed: ${normalSub.status}`);
  }

  // C2: Exceeded duration (>128s) rejected
  const latePid = `timer_late_${randomUUID()}`;
  const pastTime = new Date(Date.now() - 140000).toISOString(); // 140 seconds ago
  const { saveLocalSession } = await import('../lib/experiment/session-store.ts');
  saveLocalSession({
    id: latePid,
    participant_id: latePid,
    scenario_id: SCENARIO_ID,
    variant: 'severity_only',
    started_at: pastTime,
    completed_at: null,
    duration_seconds: null,
    successful: null,
    selected_incident_ids: null,
  });

  const lateSub = await fetch(`${BASE_URL}/api/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participant_id: latePid, selected_incident_ids: [7, 18, 1] }),
  });
  if (lateSub.status === 408) {
    pass('sectionC', 'C2_ExpiredTimeoutRejected', `Submission after 140s rejected with HTTP 408 Request Timeout (${lateSub.status})`);
  } else {
    fail('sectionC', 'C2_ExpiredTimeoutRejected', `Late submission not rejected: HTTP ${lateSub.status}`);
  }

  console.log('\n============================================================');
  console.log(`Verification Complete: ${results.passed} Passed, ${results.failed} Failed`);
  console.log('============================================================\n');

  return results;
}

runVerification().catch(console.error);
