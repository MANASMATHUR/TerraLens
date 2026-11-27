const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const testDir = path.join(process.cwd(), '.data_multiprocess_test');
const testFile = path.join(testDir, 'shared_sessions.json');

if (isMainThread) {
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(testFile, '[]', 'utf8');
  const numWorkers = 8;
  const writesPerWorker = 20; // total 160 writes
  let completedWorkers = 0;
  
  for (let w = 0; w < numWorkers; w++) {
    const worker = new Worker(__filename, { workerData: { workerId: w, writesPerWorker, testFile } });
    worker.on('message', () => {
      completedWorkers++;
      if (completedWorkers === numWorkers) {
        try {
          const raw = fs.readFileSync(testFile, 'utf8');
          const data = JSON.parse(raw);
          console.log(`RESULT: Expected: ${numWorkers * writesPerWorker}, Actual: ${data.length}`);
          if (data.length < numWorkers * writesPerWorker) {
            console.log(`CRITICAL: Lost ${numWorkers * writesPerWorker - data.length} records due to non-atomic JSON file overwrites!`);
          }
        } catch (err) {
          console.log(`CRITICAL: File corrupted (${err.message})!`);
        }
        try { fs.rmSync(testDir, { recursive: true, force: true }); } catch (e) {}
      }
    });
  }
} else {
  const { workerId, writesPerWorker, testFile } = workerData;
  for (let i = 0; i < writesPerWorker; i++) {
    try {
      let data = [];
      try {
        const raw = fs.readFileSync(testFile, 'utf8');
        data = JSON.parse(raw);
      } catch (e) {}
      data.push({ workerId, i, ts: Date.now() });
      fs.writeFileSync(testFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {}
  }
  parentPort.postMessage('done');
}
