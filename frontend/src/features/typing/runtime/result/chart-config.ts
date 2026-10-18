import { captureTypingRoute } from "../../scope";
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
import { configEvent } from "../../../../ts/events/config";
import type { AnnotationOptions } from "chartjs-plugin-annotation";
import { getResultVisible } from "../../../../ts/states/test";
import { getResultChart, setResultState } from "../../../../ts/states/result";
import { buildSpeedStats } from "../result-view-model";

export function subscribeResultConfigChanges(): void {
  configEvent.useListener(async ({ key }) => {
    const lease = captureTypingRoute();
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
      if (!lease.isCurrent()) return;
      await updateChartPBLine();
      if (!lease.isCurrent()) return;
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
