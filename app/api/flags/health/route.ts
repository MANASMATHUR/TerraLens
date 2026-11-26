import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const environmentKey = process.env.NEXT_PUBLIC_FLAGSMITH_ENVIRONMENT_KEY?.trim();
  const apiKey = process.env.FLAGSMITH_MASTER_API_KEY?.trim();
  if (!environmentKey || !apiKey) return NextResponse.json({ warehouse: 'not_configured' });
  try {
    const base = `https://api.flagsmith.com/api/v1/environments/${encodeURIComponent(environmentKey)}`;
    const headers = { Authorization: `Api-Key ${apiKey}`, Accept: 'application/json' };
    const [warehouseResponse, metricsResponse] = await Promise.all([
      fetch(`${base}/warehouse-connections/`, { headers, cache: 'no-store', signal: AbortSignal.timeout(8000) }),
      fetch(`${base}/experiment-metrics/`, { headers, cache: 'no-store', signal: AbortSignal.timeout(8000) }),
    ]);
    let warehouse = warehouseResponse.ok ? 'connection_exists_status_unavailable' : `management_api_error_${warehouseResponse.status}`;
    let metrics: string[] = [];
    if (warehouseResponse.ok) {
      const payload: unknown = await warehouseResponse.json();
      const entries = Array.isArray(payload) ? payload : [payload];
      const statuses = entries.map((entry) => entry && typeof entry === 'object' && 'status' in entry && typeof entry.status === 'string' ? entry.status : null).filter(Boolean);
      warehouse = statuses.length ? statuses.join(', ') : 'connection_exists_status_unavailable';
    }
    if (metricsResponse.ok) {
      const payload: unknown = await metricsResponse.json();
      const entries = Array.isArray(payload) ? payload : [];
      metrics = entries.flatMap((entry) => entry && typeof entry === 'object' && 'name' in entry && typeof entry.name === 'string' ? [entry.name] : []);
    }
    return NextResponse.json({ warehouse, metrics, metrics_api_answered: metricsResponse.ok });
  } catch {
    return NextResponse.json({ warehouse: 'unreachable' });
  }
}
