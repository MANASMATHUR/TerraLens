const fs = require('fs');
const path = require('path');

const env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
});

const envKey = env.FLAGSMITH_SERVER_KEY || env.NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY;
const masterKey = env.FLAGSMITH_MASTER_API_KEY;

async function check() {
  const headers = {
    'Content-Type': 'application/json',
    ...(masterKey ? { 'Authorization': `Api-Key ${masterKey}` } : {})
  };

  console.log('Using endpoint with envKey:', envKey ? envKey.slice(0, 8) + '...' : 'none');

  // Try edge API first, fallback to standard flagsmith API
  const endpoints = [
    `https://edge.api.flagsmith.com/api/v1/environments/${envKey}/experiments/581/results/`,
    `https://api.flagsmith.com/api/v1/environments/${envKey}/experiments/581/results/`
  ];

  let resultsData = null;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers });
      console.log(`GET ${url} -> ${res.status}`);
      if (res.ok) {
        resultsData = await res.json();
        break;
      } else {
        const text = await res.text();
        console.log('Error body:', text.slice(0, 200));
      }
    } catch (e) {
      console.log('Fetch error:', e.message);
    }
  }

  const expEndpoints = [
    `https://edge.api.flagsmith.com/api/v1/environments/${envKey}/experiments/581/exposures/`,
    `https://api.flagsmith.com/api/v1/environments/${envKey}/experiments/581/exposures/`
  ];

  let exposuresData = null;
  for (const url of expEndpoints) {
    try {
      const res = await fetch(url, { headers });
      console.log(`GET ${url} -> ${res.status}`);
      if (res.ok) {
        exposuresData = await res.json();
        break;
      } else {
        const text = await res.text();
        console.log('Error body:', text.slice(0, 200));
      }
    } catch (e) {
      console.log('Fetch error:', e.message);
    }
  }

  if (resultsData || exposuresData) {
    fs.mkdirSync('docs', { recursive: true });
    const frozen = {
      as_of: new Date().toISOString(),
      experiment_id: 581,
      results: resultsData,
      exposures: exposuresData
    };
    fs.writeFileSync('docs/experiment-581-frozen.json', JSON.stringify(frozen, null, 2), 'utf8');
    console.log('Successfully saved to docs/experiment-581-frozen.json');
  } else {
    console.log('Could not fetch experiment results or exposures directly.');
  }
}

check();
