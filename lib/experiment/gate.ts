import { ExperimentVariant } from '@/types';

/**
 * The arm difference is information, not decoration.
 * The control arm ('severity_only') must not see population, facilities, or road access
 * anywhere — not in chips, not in the hover card, not in the inspector panel.
 * The spatial arm ('spatial_impact') sees them.
 */
export function showSpatialContext(variant: ExperimentVariant | string | null | undefined): boolean {
  return variant === 'spatial_impact';
}
