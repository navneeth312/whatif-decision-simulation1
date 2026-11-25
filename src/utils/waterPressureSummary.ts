import { SimulationOutput } from '../types';

export interface WaterPressureAssessment {
  maxPressureKPa: number;
  maxExceeded: boolean;
  whatMayImprove: string;
  overpressureRiskNote: string | null;
}

const MAX_SAFE_PRESSURE_KPA = 550;

/**
 * Summarizes downstream water pressure safety from a domain-narrowed water solver output.
 */
export function assessWaterPressureSummary(
  rawOutput: SimulationOutput,
  primaryImprovementPct: number
): WaterPressureAssessment {
  if (rawOutput.domain !== 'water') {
    return {
      maxPressureKPa: 0,
      maxExceeded: false,
      whatMayImprove: '',
      overpressureRiskNote: null
    };
  }

  const nodeValues = Object.values(rawOutput.result.nodeResults ?? {});
  const finitePressures = nodeValues
    .map((node) => node.pressureKPa)
    .filter((pressure) => Number.isFinite(pressure));
  const maxPressureKPa = finitePressures.length > 0 ? Math.max(...finitePressures) : 0;
  const maxExceeded = maxPressureKPa > MAX_SAFE_PRESSURE_KPA;

  if (maxExceeded) {
    return {
      maxPressureKPa,
      maxExceeded: true,
      whatMayImprove: `Water pressure improves significantly in low-pressure neighborhoods (+${primaryImprovementPct}% improvement over baseline). However, pressure in some pipes exceeds configured limits. This solution requires additional pressure-reducing valves to be safe.`,
      overpressureRiskNote:
        'Operational risk: Downstream pipe pressure exceeds safe limits without pressure-reducing valves, which could lead to joint leaks or pipe fatigue if left unaddressed.'
    };
  }

  return {
    maxPressureKPa,
    maxExceeded: false,
    whatMayImprove: `Water pressure improves by +${primaryImprovementPct}% over baseline across target neighborhoods. Pipe pressures remain within safe operating limits.`,
    overpressureRiskNote: null
  };
}
