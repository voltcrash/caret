import { createAppOwned } from "#app/application.ts";
import { appObject } from "#app/state.ts";
import { captureTypingPresentation } from "../../scope";
import { applyFakeChartData } from "./fake-chart";
import { currentResult, resultAnnotations } from "./context";
import { peekConfig } from "#shared/config/store.ts";
import { showSuccessNotification } from "#shared/states/notifications.ts";
import * as Numbers from "@caret/util/numbers";
import * as Arrays from "#shared/utils/arrays.ts";
import { get as getTypingSpeedUnit } from "#shared/utils/typing-speed-units.ts";
import { getActiveFunboxes } from "../funbox/list";
import { getTheme } from "#shared/states/theme.ts";
import { getResultVisible } from "#shared/states/test.ts";
import { getLastEventLog } from "#features/typing/state/event-log.ts";
import {
  getRawHistory,
  getTimerBoundaryLabels,
} from "#shared/engine/analysis.client.ts";
import {
  getResultChart,
  getResultChartDataset,
  getResultChartScale,
} from "../../state/result";

const chartOptions = appObject(
  createAppOwned(() => ({ smoothedBurst: true, fakeChartData: false })),
);

export function toggleSmoothedBurst(): void {
  chartOptions.smoothedBurst = !chartOptions.smoothedBurst;
  showSuccessNotification(chartOptions.smoothedBurst ? "on" : "off");
  if (getResultVisible()) {
    void updateChartData().then(() => {
      getResultChart().update("resize");
    });
  }
}

export function toggleUserFakeChartData(): void {
  chartOptions.fakeChartData = !chartOptions.fakeChartData;
  showSuccessNotification(chartOptions.fakeChartData ? "on" : "off");
  if (getResultVisible()) {
    void updateChartData().then(() => {
      getResultChart().update("resize");
    });
  }
}

export async function updateChartData(): Promise<void> {
  const lease = captureTypingPresentation();
  const { Chart } = await import("chart.js");
  if (!lease.isCurrent()) return;
  const eventLog = getLastEventLog();
  const { chartData } = currentResult();
  if (chartData === "toolong" || eventLog === null) {
    getResultChartDataset("wpm").data = [];
    getResultChartDataset("raw").data = [];
    getResultChartDataset("burst").data = [];
    getResultChartDataset("error").data = [];
    return;
  }

  const typingSpeedUnit = getTypingSpeedUnit(peekConfig().typingSpeedUnit);
  getResultChartScale("wpm").title.text = typingSpeedUnit.fullUnitString;

  const labels = getTimerBoundaryLabels(eventLog, false);

  const chartData1 = [
    ...chartData.wpm.map((a) => Numbers.roundTo2(typingSpeedUnit.fromWpm(a))),
  ];

  const chartData2 = getRawHistory(eventLog).map((a) =>
    Numbers.roundTo2(typingSpeedUnit.fromWpm(a)),
  );

  const valueWindow = Math.max(...chartData.burst) * 0.25;
  let smoothedBurst = Arrays.smoothWithValueWindow(
    chartData.burst,
    1,
    chartOptions.smoothedBurst ? valueWindow : 0,
  );

  const chartData3 = [
    ...smoothedBurst.map((a) => Numbers.roundTo2(typingSpeedUnit.fromWpm(a))),
  ];

  const subcolor = getTheme().sub;

  if (peekConfig().funbox.length > 0) {
    let content = "";
    for (const fb of getActiveFunboxes()) {
      content += fb.name;
      if (fb.functions?.getResultContent) {
        content += `(${fb.functions.getResultContent()})`;
      }
      content += " ";
    }
    content = content.trimEnd();
    resultAnnotations().push({
      display: true,
      id: "funbox-label",
      type: "line",
      scaleID: "wpm",
      value: getResultChartScale("wpm").min,
      borderColor: "transparent",
      borderWidth: 1,
      borderDash: [2, 2],
      label: {
        backgroundColor: "transparent",
        font: {
          family: peekConfig().fontFamily.replace(/_/g, " "),
          size: 11,
          style: "normal",
          weight: Chart.defaults.font.weight,
          lineHeight: Chart.defaults.font.lineHeight as number,
        },
        color: subcolor,
        padding: 3,
        borderRadius: 3,
        position: "start",
        display: true,
        content: `${content}`,
      },
    });
  }

  getResultChart().data.labels = labels;

  getResultChartDataset("wpm").data = chartData1;
  getResultChartDataset("wpm").label = peekConfig().typingSpeedUnit;

  getResultChartDataset("raw").data = chartData2;

  getResultChartDataset("burst").data = chartData3;

  getResultChartDataset("error").data = chartData.err;
  getResultChartScale("error").max = Math.max(...chartData.err);

  if (chartOptions.fakeChartData) {
    applyFakeChartData();
  }
}
