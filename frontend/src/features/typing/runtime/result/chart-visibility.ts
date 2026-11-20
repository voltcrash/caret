import {
  updateMinMaxChartValues,
  applyMinMaxChartValues,
} from "./chart-bounds";
import { resultAnnotations } from "./context";
import { peekConfig } from "#shared/config/store.ts";
import { setConfig } from "#shared/config/setters.ts";
import { isAuthenticated } from "#shared/states/core.ts";
import { LocalStorageWithSchema } from "#shared/utils/local-storage-with-schema.ts";
import { z } from "zod";
import {
  getResultChart,
  getResultChartDataset,
  setResultState,
  type ResultChartLegendId,
} from "../../state/result";

const resultChartDataVisibility = new LocalStorageWithSchema({
  key: "resultChartDataVisibility",
  schema: z
    .object({
      raw: z.boolean(),
      burst: z.boolean(),
      errors: z.boolean(),
      pbLine: z.boolean(),
      tagPbLine: z.boolean(),
    })
    .strict(),
  fallback: {
    raw: true,
    burst: true,
    errors: true,
    pbLine: true,
    tagPbLine: true,
  },
});

export function updateResultChartDataVisibility(): void {
  const vis = resultChartDataVisibility.get();
  getResultChartDataset("raw").hidden = !vis.raw;
  getResultChartDataset("burst").hidden = !vis.burst;
  getResultChartDataset("error").hidden = !vis.errors;

  for (const annotation of resultAnnotations()) {
    if (annotation.id === "lpb") {
      annotation.display = vis.pbLine;
    } else if (annotation.id === "tpb") {
      annotation.display = vis.tagPbLine;
    }
  }

  // Check if there are any tag PB annotations
  const hasTagPbAnnotations = resultAnnotations().some(
    (annotation) => annotation.id === "tpb",
  );

  setResultState("chartLegend", {
    visibility: vis,
    pbLineVisible: isAuthenticated(),
    tagPbLineVisible: isAuthenticated() && hasTagPbAnnotations,
  });
}

export function toggleResultChartLegend(
  id: "scale" | ResultChartLegendId,
): void {
  if (id === "scale") {
    setConfig("startGraphsAtZero", !peekConfig().startGraphsAtZero);
    return;
  }

  const vis = resultChartDataVisibility.get();
  vis[id] = !vis[id];
  resultChartDataVisibility.set(vis);

  updateResultChartDataVisibility();
  updateMinMaxChartValues();
  applyMinMaxChartValues();
  getResultChart().update();
}
