import { updateResultChartDataVisibility } from "./chart-visibility";
import { updateChartPBLine } from "./chart-pb";
import { updateChartData } from "./chart-data";
import {
  updateMinMaxChartValues,
  applyMinMaxChartValues,
} from "./chart-bounds";
import { getEventLogAccuracy } from "./accuracy";
import { result, resultAnnotation, resetResultAnnotations } from "./context";
import type { PluginChartOptions } from "chart.js";
import { configEvent } from "../../events/config";
import type { AnnotationOptions } from "chartjs-plugin-annotation";
import { getResultVisible } from "../../states/test";
import { getResultChart, setResultState } from "../../states/result";
import { buildSpeedStats } from "../result-view-model";

export function subscribeResultConfigChanges(): void {
  configEvent.useListener(async ({ key }) => {
    if (
      ["typingSpeedUnit", "startGraphsAtZero"].includes(key) &&
      getResultVisible()
    ) {
      resetResultAnnotations();

      setResultState(
        "stats",
        (stats) =>
          stats && {
            ...stats,
            ...buildSpeedStats(result, getEventLogAccuracy()),
          },
      );
      await updateChartData();
      await updateChartPBLine();
      updateResultChartDataVisibility();
      updateMinMaxChartValues();
      applyMinMaxChartValues();

      ((getResultChart().options as PluginChartOptions<"line" | "scatter">)
        .plugins.annotation.annotations as AnnotationOptions<"line">[]) =
        resultAnnotation;
      getResultChart().update();
      getResultChart().resize();
    }
  });
}
