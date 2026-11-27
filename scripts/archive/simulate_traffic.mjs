#!/usr/bin/env node

console.error('Synthetic participant traffic is disabled for Track 01.');
console.error('Use scripts/project_expected_effect.mjs for offline model projections.');
console.error('Do not send simulated sessions or outcomes to Flagsmith.');
process.exitCode = 1;
