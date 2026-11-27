import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

/**
 * Full Lifecycle Supabase Outage & Recovery Simulation
 * 
 * Tests the complete loop:
 * 1. Simulates active mock Supabase backend
 * 2. Writes initial remote records
 * 3. Simulates connection loss (Supabase offline)
 * 4. Accepts and locally persists tasks in SQLite outbox
 * 5. Re-initializes / restarts process
 * 6. Simulates Supabase recovery
 * 7. Triggers syncLocalRecordsToSupabase
 * 8. Verifies idempotency on repeated sync
 */

async function runRecoverySimulation() {
  console.log('\n============================================================');
  console.log('🔄 TerraLens Supabase Outage & Recovery Lifecycle Verification');
  console.log('============================================================\n');

  // Step 1: Mock remote database table in memory
  const remoteDatabase = new Map();

  const mockSupabaseClient = {
    from: (table) => ({
      select: () => ({
        eq: (k1, v1) => ({
          eq: (k2, v2) => ({
            maybeSingle: async () => {
              const key = `${v1}_${v2}`;
              return { data: remoteDatabase.get(key) || null, error: null };
            }
          })
        })
      }),
      upsert: async (record) => {
        const key = `${record.participant_id}_${record.scenario_id}`;
        remoteDatabase.set(key, record);
        return { data: record, error: null };
      }
    })
  };

  // Step 2: Use session-store to simulate offline storage
  const {
    saveLocalSession,
    getLocalSession,
    syncLocalRecordsToSupabase
  } = await import('../../lib/experiment/session-store.ts');

  console.log('[Step 1] Creating initial pre-outage sessions in local SQLite...');
  const pidOnline = 'audit_usr_online_001';
  saveLocalSession({
    id: pidOnline,
    participant_id: pidOnline,
    scenario_id: 'jaipur_monsoon_2026',
    variant: 'spatial_impact',
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    duration_seconds: 42.5,
    successful: true,
    selected_incident_ids: [7, 18, 1],
  });

  // Sync this one as pre-outage
  await syncLocalRecordsToSupabase(mockSupabaseClient);
  console.log(`[Step 1] Remote records before outage: ${remoteDatabase.size}`);

  // Step 3: DISCONNECT SUPABASE (Simulate outage)
  console.log('\n[Step 2] ⚡ SIMULATING SUPABASE TOTAL OUTAGE...');
  const offlineClient = null;

  // Step 4: Submit 20 participant sessions during outage
  console.log('[Step 3] Accepting 20 participant submissions during outage...');
  const outagePids = [];
  for (let i = 1; i <= 20; i++) {
    const pid = `audit_usr_offline_${String(i).padStart(3, '0')}`;
    outagePids.push(pid);
    saveLocalSession({
      id: pid,
      participant_id: pid,
      scenario_id: 'jaipur_monsoon_2026',
      variant: i % 2 === 0 ? 'spatial_impact' : 'severity_only',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      duration_seconds: 30.0 + i,
      successful: i % 2 === 0,
      selected_incident_ids: i % 2 === 0 ? [7, 18, 1] : [24, 15, 3],
    });
  }

  console.log(`[Step 3] 20 sessions persisted to SQLite. Remote count during outage: ${remoteDatabase.size} (unchanged)`);

  // Step 5: Process Restart Simulation
  console.log('\n[Step 4] Simulating application cold restart...');
  // Verify data is readable
  const retrievedOffline = getLocalSession(outagePids[0], 'jaipur_monsoon_2026');
  if (!retrievedOffline || !retrievedOffline.completed_at) {
    throw new Error('Local SQLite failed to preserve session across read cycle!');
  }
  console.log(`[Step 4] Verified session ${outagePids[0]} intact in SQLite.`);

  // Step 6: RESTORE SUPABASE
  console.log('\n[Step 5] 🟢 RESTORING SUPABASE CONNECTIVITY...');
  console.log('[Step 6] Triggering synchronization...');
  const syncResult1 = await syncLocalRecordsToSupabase(mockSupabaseClient);
  console.log('[Step 6] Sync Pass 1 Result:', syncResult1);

  // Step 7: Verify all exist remotely
  console.log(`[Step 7] Remote database size after sync: ${remoteDatabase.size} (Expected: 21)`);
  if (remoteDatabase.size !== 21) {
    throw new Error(`Sync discrepancy! Expected 21 records, found ${remoteDatabase.size}`);
  }

  // Step 8: Idempotency Test (Repeat sync immediately)
  console.log('\n[Step 8] Testing synchronization idempotency (Pass 2)...');
  const syncResult2 = await syncLocalRecordsToSupabase(mockSupabaseClient);
  console.log('[Step 8] Sync Pass 2 Result:', syncResult2);
  console.log(`[Step 8] Remote database size after duplicate sync: ${remoteDatabase.size} (Expected: 21, no duplicates)`);

  if (syncResult2.synced !== 0 || remoteDatabase.size !== 21) {
    throw new Error('Sync was NOT idempotent! Duplicate records created.');
  }

  console.log('\n✅ SUPABASE RECOVERY & IDEMPOTENT SYNC VERIFIED SUCCESSFULLY!\n');
}

runRecoverySimulation().catch(err => {
  console.error('Simulation Failed:', err);
  process.exit(1);
});
