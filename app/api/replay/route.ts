import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const jsonPath = path.join(process.cwd(), 'public', 'geo', 'incidents_data.json');

    if (!fs.existsSync(jsonPath)) {
      return NextResponse.json({ error: 'Incidents data not found' }, { status: 404 });
    }

    const incidentsRaw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    // Sort by mechanical severity (Control: S_A)
    const severitySorted = [...incidentsRaw].sort(
      (a, b) => b.severity_score - a.severity_score
    );

    // Sort by spatial context multiplier (Treatment: S_B)
    const spatialSorted = [...incidentsRaw]
      .map((item) => {
        const c = item.context;
        const C = 0.60 * c.population_index + 0.30 * c.facility_index + 0.10 * c.accessibility_index;
        const spatial_score = item.severity_score * (0.55 + 0.45 * C);
        return { ...item, spatial_score: Number(spatial_score.toFixed(1)) };
      })
      .sort((a, b) => b.spatial_score - a.spatial_score);

    // Compare each incident across both arms WITHOUT any benchmark/ground-truth leakage
    const comparison = incidentsRaw.map((inc: any) => {
      const sevRank = severitySorted.findIndex((d) => d.id === inc.id) + 1;
      const spaItem = spatialSorted.find((d) => d.id === inc.id);
      const spaRank = spatialSorted.findIndex((d) => d.id === inc.id) + 1;
      const delta = sevRank - spaRank; // positive = promoted in priority, negative = demoted

      return {
        id: inc.id,
        title: inc.title,
        description: inc.description,
        incident_type: inc.incident_type,
        severity_score: inc.severity_score,
        spatial_score: spaItem?.spatial_score || inc.severity_score,
        severity_rank: sevRank,
        spatial_rank: spaRank,
        rank_delta: delta, // > 0 means moved UP under spatial
        population_exposed: inc.context.population_exposed,
        hospital_count: inc.context.hospital_count,
        fire_station_count: inc.context.fire_station_count,
        nearest_road_m: inc.context.nearest_road_distance_m,
        impact_radius_m: inc.impact_radius_m,
        coordinates: inc.geometry?.coordinates || [inc.lon, inc.lat],
        is_synthetic: inc.is_synthetic ?? true,
      };
    });

    // Summary statistics for Decision Replay: Control vs Treatment Top 3 Strategy Outcomes
    const controlTop3 = severitySorted.slice(0, 3).map((d) => d.id);
    const treatmentTop3 = spatialSorted.slice(0, 3).map((d) => d.id);

    const controlTop3Details = controlTop3.map((id) => comparison.find((c: any) => c.id === id));
    const treatmentTop3Details = treatmentTop3.map((id) => comparison.find((c: any) => c.id === id));

    const totalPopControlTop3 = controlTop3Details.reduce((sum: number, c: any) => sum + (c?.population_exposed || 0), 0);
    const totalPopTreatmentTop3 = treatmentTop3Details.reduce((sum: number, c: any) => sum + (c?.population_exposed || 0), 0);

    const totalHospsControlTop3 = controlTop3Details.reduce((sum: number, c: any) => sum + (c?.hospital_count || 0), 0);
    const totalHospsTreatmentTop3 = treatmentTop3Details.reduce((sum: number, c: any) => sum + (c?.hospital_count || 0), 0);

    return NextResponse.json({
      incidents: comparison,
      summary: {
        control_top_3: controlTop3,
        treatment_top_3: treatmentTop3,
        control_estimated_population_exposure: totalPopControlTop3,
        treatment_estimated_population_exposure: totalPopTreatmentTop3,
        control_hospitals_covered: totalHospsControlTop3,
        treatment_hospitals_covered: totalHospsTreatmentTop3,
      },
    });
  } catch (err) {
    console.error('Error in GET /api/replay:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
