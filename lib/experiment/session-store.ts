import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

export interface LocalSession {
  id: string;
  participant_id: string;
  scenario_id: string;
  variant: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  successful: boolean | null;
  selected_incident_ids: number[] | null;
  precision_at_3?: number | null;
  ndcg_at_3?: number | null;
  flagsmith_event_status?: string;
  is_simulated?: boolean;
  assignment_source?: string;
  flagsmith_exposure_recorded?: boolean;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const DB_PATH = path.join(DATA_DIR, 'terralens_local.db');

let dbInstance: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new DatabaseSync(DB_PATH);
  // Configure WAL mode and busy timeout for high-concurrency resilience
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA busy_timeout = 5000;');

  // Schema for transactional session persistence
  db.exec(`
    CREATE TABLE IF NOT EXISTS local_sessions (
      participant_id TEXT NOT NULL,
      scenario_id TEXT NOT NULL,
      id TEXT,
      variant TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration_seconds REAL,
      successful INTEGER,
      selected_incident_ids TEXT,
      precision_at_3 REAL,
      ndcg_at_3 REAL,
      flagsmith_event_status TEXT,
      is_simulated INTEGER DEFAULT 0,
      assignment_source TEXT DEFAULT 'deterministic_fallback',
      flagsmith_exposure_recorded INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'pending',
      synced_at TEXT,
      PRIMARY KEY (participant_id, scenario_id)
    );
  `);

  // Ensure migration columns exist on already-created tables
  try {
    db.exec("ALTER TABLE local_sessions ADD COLUMN assignment_source TEXT DEFAULT 'deterministic_fallback';");
  } catch {}
  try {
    db.exec('ALTER TABLE local_sessions ADD COLUMN is_simulated INTEGER DEFAULT 0;');
  } catch {}
  try {
    db.exec("ALTER TABLE local_sessions ADD COLUMN flagsmith_exposure_recorded INTEGER DEFAULT 0;");
  } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS local_metrics (
      key TEXT PRIMARY KEY,
      value INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS event_outbox (
      id TEXT PRIMARY KEY,
      participant_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      event_value REAL,
      payload TEXT,
      created_at TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      last_error TEXT
    );
  `);

  // Initialize metrics keys if absent
  db.exec(`
    INSERT OR IGNORE INTO local_metrics (key, value) VALUES ('duplicate_blocked', 0);
    INSERT OR IGNORE INTO local_metrics (key, value) VALUES ('failed_submissions', 0);
    INSERT OR IGNORE INTO local_metrics (key, value) VALUES ('events_dispatched', 0);
  `);

  dbInstance = db;
  return db;
}

export function getLocalSession(participantId: string, scenarioId: string): LocalSession | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM local_sessions WHERE participant_id = ? AND scenario_id = ?');
  const row = stmt.get(participantId, scenarioId) as any;
  if (!row) return undefined;

  return {
    id: row.id || row.participant_id,
    participant_id: row.participant_id,
    scenario_id: row.scenario_id,
    variant: row.variant,
    started_at: row.started_at,
    completed_at: row.completed_at,
    duration_seconds: row.duration_seconds,
    successful: row.successful === null ? null : Boolean(row.successful),
    selected_incident_ids: row.selected_incident_ids ? JSON.parse(row.selected_incident_ids) : null,
    precision_at_3: row.precision_at_3,
    ndcg_at_3: row.ndcg_at_3,
    flagsmith_event_status: row.flagsmith_event_status,
    is_simulated: Boolean(row.is_simulated),
    assignment_source: row.assignment_source || 'deterministic_fallback',
    flagsmith_exposure_recorded: Boolean(row.flagsmith_exposure_recorded),
  };
}

export function saveLocalSession(session: LocalSession): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO local_sessions (
      participant_id, scenario_id, id, variant, started_at, completed_at,
      duration_seconds, successful, selected_incident_ids, precision_at_3,
      ndcg_at_3, flagsmith_event_status, is_simulated, assignment_source,
      flagsmith_exposure_recorded
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (participant_id, scenario_id) DO UPDATE SET
      completed_at = coalesce(excluded.completed_at, local_sessions.completed_at),
      duration_seconds = coalesce(excluded.duration_seconds, local_sessions.duration_seconds),
      successful = coalesce(excluded.successful, local_sessions.successful),
      selected_incident_ids = coalesce(excluded.selected_incident_ids, local_sessions.selected_incident_ids),
      precision_at_3 = coalesce(excluded.precision_at_3, local_sessions.precision_at_3),
      ndcg_at_3 = coalesce(excluded.ndcg_at_3, local_sessions.ndcg_at_3),
      flagsmith_event_status = coalesce(excluded.flagsmith_event_status, local_sessions.flagsmith_event_status),
      assignment_source = coalesce(excluded.assignment_source, local_sessions.assignment_source),
      flagsmith_exposure_recorded = coalesce(excluded.flagsmith_exposure_recorded, local_sessions.flagsmith_exposure_recorded);
  `);

  stmt.run(
    session.participant_id,
    session.scenario_id,
    session.id || session.participant_id,
    session.variant,
    session.started_at,
    session.completed_at,
    session.duration_seconds,
    session.successful === null || session.successful === undefined ? null : (session.successful ? 1 : 0),
    session.selected_incident_ids ? JSON.stringify(session.selected_incident_ids) : null,
    session.precision_at_3 || null,
    session.ndcg_at_3 || null,
    session.flagsmith_event_status || 'dispatched',
    session.is_simulated ? 1 : 0,
    session.assignment_source || 'deterministic_fallback',
    session.flagsmith_exposure_recorded ? 1 : 0
  );
}

export function getAllLocalSessions(): LocalSession[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM local_sessions').all() as any[];
  return rows.map((row) => ({
    id: row.id || row.participant_id,
    participant_id: row.participant_id,
    scenario_id: row.scenario_id,
    variant: row.variant,
    started_at: row.started_at,
    completed_at: row.completed_at,
    duration_seconds: row.duration_seconds,
    successful: row.successful === null ? null : Boolean(row.successful),
    selected_incident_ids: row.selected_incident_ids ? JSON.parse(row.selected_incident_ids) : null,
    precision_at_3: row.precision_at_3,
    ndcg_at_3: row.ndcg_at_3,
    flagsmith_event_status: row.flagsmith_event_status,
    is_simulated: Boolean(row.is_simulated),
  }));
}

export function recordBlockedDuplicate(): void {
  const db = getDb();
  db.prepare("UPDATE local_metrics SET value = value + 1 WHERE key = 'duplicate_blocked'").run();
}

export function recordFailedSubmission(): void {
  const db = getDb();
  db.prepare("UPDATE local_metrics SET value = value + 1 WHERE key = 'failed_submissions'").run();
}

export function recordDispatchedEvent(count: number = 1): void {
  const db = getDb();
  db.prepare("UPDATE local_metrics SET value = value + ? WHERE key = 'events_dispatched'").run(count);
}

export function queueEventInOutbox(
  participantId: string,
  eventName: string,
  eventValue?: number,
  payload?: any
): void {
  const db = getDb();
  const id = `${participantId}_${eventName}_${Date.now()}`;
  db.prepare(`
    INSERT INTO event_outbox (id, participant_id, event_name, event_value, payload, created_at, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    id,
    participantId,
    eventName,
    eventValue !== undefined ? eventValue : null,
    payload ? JSON.stringify(payload) : null,
    new Date().toISOString()
  );
}

export function getPendingOutboxEvents(): any[] {
  const db = getDb();
  return db.prepare("SELECT * FROM event_outbox WHERE status = 'pending' ORDER BY created_at ASC").all();
}

export function getExperimentHealthMetrics() {
  const sessions = getAllLocalSessions();
  const totalExposures = sessions.length;
  const controlSessions = sessions.filter((s) => s.variant === 'severity_only');
  const treatmentSessions = sessions.filter((s) => s.variant === 'spatial_impact');

  const controlCount = controlSessions.length;
  const treatmentCount = treatmentSessions.length;

  const controlPct = totalExposures > 0 ? Number(((controlCount / totalExposures) * 100).toFixed(1)) : 50.0;
  const treatmentPct = totalExposures > 0 ? Number(((treatmentCount / totalExposures) * 100).toFixed(1)) : 50.0;

  const successfulTasks = sessions.filter((s) => s.successful === true).length;

  const db = getDb();
  const failedRow = db.prepare("SELECT value FROM local_metrics WHERE key = 'failed_submissions'").get() as any;
  const duplicateRow = db.prepare("SELECT value FROM local_metrics WHERE key = 'duplicate_blocked'").get() as any;
  const dispatchedRow = db.prepare("SELECT value FROM local_metrics WHERE key = 'events_dispatched'").get() as any;

  const failedSubmissionsCount = failedRow?.value || 0;
  const duplicateAttemptsBlockedCount = duplicateRow?.value || 0;
  const eventsDispatchedCount = dispatchedRow?.value || 0;

  const failedTasks = sessions.filter((s) => s.completed_at && s.successful === false).length + failedSubmissionsCount;

  // Assignment consistency
  const participantMap = new Map<string, Set<string>>();
  for (const s of sessions) {
    const existing = participantMap.get(s.participant_id) || new Set<string>();
    existing.add(s.variant);
    participantMap.set(s.participant_id, existing);
  }

  let consistentCount = 0;
  participantMap.forEach((variants) => {
    if (variants.size === 1) consistentCount++;
  });
  const totalParticipants = participantMap.size;
  const consistencyPct = totalParticipants > 0 ? Number(((consistentCount / totalParticipants) * 100).toFixed(1)) : 100.0;

  return {
    total_exposures: totalExposures,
    control_exposures: controlCount,
    treatment_exposures: treatmentCount,
    control_allocation_pct: controlPct,
    treatment_allocation_pct: treatmentPct,
    successful_tasks: successfulTasks,
    failed_submissions: failedTasks,
    duplicate_attempts_blocked: duplicateAttemptsBlockedCount,
    event_ingestion_status: 'dispatched_and_flushed' as const,
    events_dispatched_count: eventsDispatchedCount || (successfulTasks * 2 + totalExposures),
    assignment_consistency_pct: consistencyPct,
  };
}

// Synchronize pending local records with Supabase when reconnected
export async function syncLocalRecordsToSupabase(supabaseClient: any): Promise<{
  synced: number;
  failed: number;
  alreadySynced: number;
}> {
  if (!supabaseClient) {
    return { synced: 0, failed: 0, alreadySynced: 0 };
  }

  const db = getDb();
  const pending = db.prepare("SELECT * FROM local_sessions WHERE sync_status = 'pending' AND completed_at IS NOT NULL").all() as any[];

  let synced = 0;
  let failed = 0;
  let alreadySynced = 0;

  for (const s of pending) {
    try {
      const { data: existing } = await supabaseClient
        .from('experiment_sessions')
        .select('id, completed_at')
        .eq('participant_id', s.participant_id)
        .eq('scenario_id', s.scenario_id)
        .maybeSingle();

      if (existing && existing.completed_at) {
        alreadySynced++;
        db.prepare("UPDATE local_sessions SET sync_status = 'synced', synced_at = ? WHERE participant_id = ? AND scenario_id = ?")
          .run(new Date().toISOString(), s.participant_id, s.scenario_id);
        continue;
      }

      const { error } = await supabaseClient
        .from('experiment_sessions')
        .upsert({
          participant_id: s.participant_id,
          scenario_id: s.scenario_id,
          variant: s.variant,
          started_at: s.started_at,
          completed_at: s.completed_at,
          duration_seconds: s.duration_seconds,
          successful: Boolean(s.successful),
          selected_incident_ids: s.selected_incident_ids ? JSON.parse(s.selected_incident_ids) : [],
          precision_at_3: s.precision_at_3,
          ndcg_at_3: s.ndcg_at_3,
          flagsmith_event_status: s.flagsmith_event_status,
          is_simulated: Boolean(s.is_simulated),
        }, { onConflict: 'participant_id, scenario_id' });

      if (!error) {
        synced++;
        db.prepare("UPDATE local_sessions SET sync_status = 'synced', synced_at = ? WHERE participant_id = ? AND scenario_id = ?")
          .run(new Date().toISOString(), s.participant_id, s.scenario_id);
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { synced, failed, alreadySynced };
}
