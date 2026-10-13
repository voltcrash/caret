import type { QuantumFit, Significant } from "@oxytype/util/timing-stats";

/** placeholder shown for any stat that could not be computed */
export const MISSING_STAT = "-";

/** correlation with its significance, e.g. "0.42 (3.1σ)" */
export function formatSignificant(value: Significant | null): string {
  if (value === null) return MISSING_STAT;
  return `${value.r.toFixed(2)} (${value.sigmas.toFixed(1)}σ)`;
}

/** z score, e.g. "-2.4σ" */
export function formatSigmas(z: number | null): string {
  if (z === null) return MISSING_STAT;
  return `${z.toFixed(1)}σ`;
}

/** fraction as a whole percentage, e.g. "37%" */
export function formatPercent(rate: number | null): string {
  if (rate === null) return MISSING_STAT;
  return `${(rate * 100).toFixed(0)}%`;
}

/** grid period with its strength, e.g. "8.00ms (0.91)" */
export function formatQuantum(quantum: QuantumFit): string {
  if (quantum === null) return MISSING_STAT;
  return `${quantum.periodMs.toFixed(2)}ms (${quantum.strength.toFixed(2)})`;
}
