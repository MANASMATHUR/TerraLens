import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * POST-EXPERIMENT RESTRICTED AUDIT ENDPOINT
 * Exposes benchmark calibration metrics ONLY when an authorized dedicated administrative secret is provided.
 * Decoupled from the external Flagsmith Master API Key for architectural least privilege.
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const adminSecret = process.env.ADMIN_AUDIT_SECRET || '';

    // Validate that the request provides the dedicated administrative audit secret
    const isAuthorized =
      adminSecret &&
      (authHeader === `Bearer ${adminSecret}` ||
        authHeader === `Api-Key ${adminSecret}`);

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Post-experiment benchmark audit requires dedicated administrative credentials' },
        { status: 401 }
      );
    }

    const bmPath = path.join(process.cwd(), 'data', 'benchmarks_server_only.json');
    if (!fs.existsSync(bmPath)) {
      return NextResponse.json({ error: 'Benchmark dataset not found' }, { status: 404 });
    }

    const bmData = JSON.parse(fs.readFileSync(bmPath, 'utf8'));
    const benchmarkTop3 = bmData
      .sort((a: any, b: any) => a.reference_rank - b.reference_rank)
      .slice(0, 3)
      .map((b: any) => b.incident_id);

    return NextResponse.json({
      audit_access: 'authorized_admin',
      benchmark_version: 'v1.0',
      benchmark_top_3: benchmarkTop3,
      total_benchmarked_incidents: bmData.length,
      authorization_mode: 'dedicated_admin_secret',
    });
  } catch (err) {
    console.error('Error in GET /api/admin/benchmark-audit:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
