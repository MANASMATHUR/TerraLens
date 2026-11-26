#!/usr/bin/env node

/**
 * Flagsmith assignment smoke only. Creates QA exposures and never submits a task,
 * writes a session, or records a conversion/outcome.
 */
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Flagsmith } from '@flagsmith/nodejs';

if (!process.argv.includes('--exposures-only')) {
  throw new Error('Only exposure smoke mode is available. Pass --exposures-only; use the offline projection script for model scenarios.');
}

const envFile = fs.readFileSync('.env.local', 'utf8');
const values = new Map(envFile.split(/\r?\n/).map((line) => {
  const separator = line.indexOf('=');
  return separator < 0 ? ['', ''] : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
}));
const environmentKey = values.get('NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY');
const flagName = values.get('NEXT_PUBLIC_FLAG_STRATEGY') || 'incident_prioritization_strategy';
if (!environmentKey) throw new Error('NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY is missing from .env.local.');

const flagsmith = new Flagsmith({ environmentKey, enableEvents: true });
const counts = { severity_only: 0, spatial_impact: 0 };
const seen = new Set();

console.log('Flagsmith QA exposure smoke; no sessions or conversion events will be created.');
console.log('Assignments are read from ' + flagName + '.');

for (let i = 0; i < 100 && seen.size < 2; i++) {
  const participantId = 'terralens_qa_exposure_' + randomUUID();
  const flag = await flagsmith.getExperimentFlag(flagName, participantId);
  if (!flag || flag.isDefault || !flag.enabled) {
    throw new Error('Flagsmith did not return an enabled ' + flagName + ' flag for ' + participantId + '.');
  }
  if (!flag.experiment?.inExperiment) {
    throw new Error('Flagsmith did not enroll ' + participantId + ' in the running experiment.');
  }
  if (!flag.variant || (flag.value !== 'severity_only' && flag.value !== 'spatial_impact')) {
    throw new Error('Flagsmith returned a missing or unsupported strategy value: ' + String(flag.value) + '.');
  }

  counts[flag.value]++;
  seen.add(flag.value);
  await flagsmith.flushEvents();
  console.log('Assigned ' + flag.value + '; exposures: severity_only=' + counts.severity_only + ', spatial_impact=' + counts.spatial_impact);
}

console.log('Final Flagsmith QA exposure counts: severity_only=' + counts.severity_only + ', spatial_impact=' + counts.spatial_impact);
if (seen.size !== 2) throw new Error('Both experiment arms were not observed during the exposure smoke run.');
