import { describe, expect, it } from "vite-plus/test";

import {
  formatPercent,
  formatQuantum,
  formatSignificant,
  formatSigmas,
  MISSING_STAT,
} from "../../../../src/ts/components/modals/event-log-viewer/stat-format";

describe("stat formatters", () => {
  it("formats a correlation with its significance", () => {
    expect(formatSignificant({ r: 0.4234, sigmas: 3.14 })).toBe("0.42 (3.1σ)");
    expect(formatSignificant({ r: -0.1, sigmas: -1.06 })).toBe("-0.10 (-1.1σ)");
  });

  it("formats a z score", () => {
    expect(formatSigmas(-2.44)).toBe("-2.4σ");
  });

  it("formats a rate as a whole percentage", () => {
    expect(formatPercent(0.374)).toBe("37%");
    expect(formatPercent(0)).toBe("0%");
  });

  it("formats a quantum fit", () => {
    expect(formatQuantum({ periodMs: 8, strength: 0.912 })).toBe(
      "8.00ms (0.91)",
    );
  });

  it("shows a dash for missing values", () => {
    expect(MISSING_STAT).toBe("-");
    expect(formatSignificant(null)).toBe(MISSING_STAT);
    expect(formatSigmas(null)).toBe(MISSING_STAT);
    expect(formatPercent(null)).toBe(MISSING_STAT);
    expect(formatQuantum(null)).toBe(MISSING_STAT);
  });
});
