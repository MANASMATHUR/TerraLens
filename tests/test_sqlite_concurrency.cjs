const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const testDir = path.join(process.cwd(), '.data_sqlite_test');
const dbFile = path.join(testDir, 'test_wal.db');

if (isMainThread) {
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
  if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);

  const initDb = new DatabaseSync(dbFile);
  initDb.exec('PRAGMA journal_mode = WAL;');
  initDb.exec('PRAGMA synchronous = NORMAL;');
  initDb.exec('PRAGMA busy_timeout = 5000;');
  initDb.exec(`
    CREATE TABLE test_sessions (
      participant_id TEXT PRIMARY KEY,
      variant TEXT,
      created_at TEXT
    );
  `);
  initDb.close();

  const numWorkers = 8;
  const writesPerWorker = 25; // 200 total writes across 8 threads
  let completedWorkers = 0;

  for (let w = 0; w < numWorkers; w++) {
    const worker = new Worker(__filename, { workerData: { workerId: w, writesPerWorker, dbFile } });
    worker.on('message', () => {
      completedWorkers++;
      if (completedWorkers === numWorkers) {
        const verifyDb = new DatabaseSync(dbFile);
        const count = verifyDb.prepare('SELECT COUNT(*) as c FROM test_sessions').get().c;
        console.log(`SQLITE WAL RESULT: Expected: ${numWorkers * writesPerWorker}, Actual: ${count}`);
        verifyDb.close();
        try { fs.rmSync(testDir, { recursive: true, force: true }); } catch (e) {}
      }
    });
  }
} else {
  const { workerId, writesPerWorker, dbFile } = workerData;
  const db = new DatabaseSync(dbFile);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  const stmt = db.prepare('INSERT INTO test_sessions (participant_id, variant, created_at) VALUES (?, ?, ?)');

  for (let i = 0; i < writesPerWorker; i++) {
    const pid = `worker_${workerId}_req_${i}`;
    stmt.run(pid, 'spatial_impact', new Date().toISOString());
  }
  db.close();
  parentPort.postMessage('done');
}
