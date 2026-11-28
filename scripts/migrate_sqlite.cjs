const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(process.cwd(), '.data', 'terralens_local.db');
const db = new DatabaseSync(dbPath);

try {
  db.exec("ALTER TABLE local_sessions ADD COLUMN assignment_source TEXT DEFAULT 'deterministic_fallback';");
  console.log('Added assignment_source column');
} catch (e) {
  console.log('assignment_source column:', e.message);
}

try {
  db.exec("ALTER TABLE local_sessions ADD COLUMN flagsmith_exposure_recorded INTEGER DEFAULT 0;");
  console.log('Added flagsmith_exposure_recorded column');
} catch (e) {
  console.log('flagsmith_exposure_recorded column:', e.message);
}

db.close();
console.log('Migration complete.');
