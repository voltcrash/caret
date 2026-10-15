import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const Samples = z.array(z.number().nonnegative()).min(5);
const Measurements = z.record(z.string(), Samples);
const Budget = z.object({
  median: z.number().nonnegative(),
  p95: z.number().nonnegative(),
});
const Frozen = z.record(
  z.string(),
  z.object({
    samples: Samples,
    median: z.number(),
    p95: z.number(),
    min: z.number(),
    max: z.number(),
    budget: Budget,
  }),
);

export function summarize(input: readonly number[]): {
  median: number;
  p95: number;
  min: number;
  max: number;
} {
  const samples = Samples.parse(input).sort((a, b) => a - b);
  const at = (quantile: number): number =>
    samples[Math.ceil(samples.length * quantile) - 1] as number;
  return {
    median: at(0.5),
    p95: at(0.95),
    min: samples[0] as number,
    max: samples.at(-1) as number,
  };
}

/** Freeze once before Start implementation. Count/size budgets permit no growth. */
export function freeze(input: unknown): z.infer<typeof Frozen> {
  const measurements = Measurements.parse(input);
  return Object.fromEntries(
    Object.entries(measurements).map(([key, samples]) => {
      const summary = summarize(samples);
      const margin =
        key.startsWith("d1") || key.endsWith("Bytes")
          ? 0
          : Math.max(summary.p95 - summary.median, summary.median * 0.1);
      return [
        key,
        {
          samples,
          ...summary,
          budget: {
            median: summary.median + margin,
            p95: summary.p95 + margin,
          },
        },
      ];
    }),
  );
}

export function compare(frozen: unknown, candidate: unknown): string[] {
  const baseline = Frozen.parse(frozen);
  const measurements = Measurements.parse(candidate);
  const failures: string[] = [];
  for (const [key, baselineMetric] of Object.entries(baseline)) {
    const samples = measurements[key];
    if (samples === undefined) {
      failures.push(`${key}: missing samples`);
      continue;
    }
    const summary = summarize(samples);
    for (const statistic of ["median", "p95"] as const) {
      if (summary[statistic] > baselineMetric.budget[statistic]) {
        failures.push(
          `${key} ${statistic}: ${summary[statistic]} > ${baselineMetric.budget[statistic]}`,
        );
      }
    }
  }
  return failures;
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [mode, baselinePath, candidatePath] = process.argv.slice(2);
  if (
    baselinePath === undefined ||
    candidatePath === undefined ||
    !["freeze", "check"].includes(mode ?? "")
  ) {
    throw new Error(
      "Usage: migration-performance.ts freeze measurements.json budgets.json | check budgets.json measurements.json",
    );
  }
  const baseline: unknown = JSON.parse(readFileSync(baselinePath, "utf8"));
  if (mode === "freeze") {
    writeFileSync(
      candidatePath,
      `${JSON.stringify(freeze(baseline), null, 2)}\n`,
    );
  } else {
    const failures = compare(
      baseline,
      JSON.parse(readFileSync(candidatePath, "utf8")),
    );
    if (failures.length > 0) throw new Error(failures.join("\n"));
    console.info("All frozen migration budgets pass");
  }
}
