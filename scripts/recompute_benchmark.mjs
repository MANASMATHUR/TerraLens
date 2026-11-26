import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'public/geo/incidents_data.json'), 'utf8'));
const ranked = source.map((incident) => {
  const c = Number(incident.context?.composite_c);
  if (!Number.isFinite(c) || c < 0 || c > 1) throw new Error(`Incident ${incident.id} has invalid composite_c`);
  const score = 0.8 * (Number(incident.severity_score) / 100) + 0.2 * c;
  return { incident_id: incident.id, reference_impact_score: Number((score * 100).toFixed(4)), reference_rank: 0, benchmark_version: 'v2.0' };
}).sort((a, b) => b.reference_impact_score - a.reference_impact_score)
  .map((row, index) => ({ ...row, reference_rank: index + 1 }));

const outputDir = path.join(root, 'data');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'benchmarks_server_only.json'), `${JSON.stringify(ranked, null, 2)}\n`);

const seedPath = path.join(root, 'supabase/seed.sql');
let seed = fs.readFileSync(seedPath, 'utf8');
for (const row of ranked) {
  const expression = new RegExp(`\\(${row.incident_id},\\s*([0-9.]+),\\s*[0-9.]+,\\s*[0-9]+,\\s*'v[0-9.]+'\\)`);
  if (!expression.test(seed)) throw new Error(`Missing benchmark seed row for incident ${row.incident_id}`);
  seed = seed.replace(expression, `(${row.incident_id}, $1, ${row.reference_impact_score}, ${row.reference_rank}, 'v2.0')`);
}
fs.writeFileSync(seedPath, seed);
console.log(JSON.stringify({ benchmark_version: 'v2.0', formula: '0.8 * normalized_severity + 0.2 * composite_c', top3: ranked.slice(0, 3).map((row) => row.incident_id) }));
