import { createAppOwned } from "../../../../app/application";
import { appObject } from "../../../../app/state";
import { captureTypingPresentation } from "../../scope";
import { applyFakeChartData } from "./fake-chart";
import { currentResult, resultAnnotations } from "./context";
import { getMutableConfig } from "../../../../ts/config/store";
import { showSuccessNotification } from "../../../../ts/states/notifications";
import * as Numbers from "@caret/util/numbers";
import * as Arrays from "../../../../ts/utils/arrays";
import { get as getTypingSpeedUnit } from "../../../../ts/utils/typing-speed-units";
import { getActiveFunboxes } from "../funbox/list";
import { getTheme } from "../../../../ts/states/theme";
import { getLastEventLog, getResultVisible } from "../../../../ts/states/test";
import { getRawHistory, getTimerBoundaryLabels } from "../../analysis.client";
import {
  getResultChart,
  getResultChartDataset,
  getResultChartScale,
} from "../../../../ts/states/result";

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

  const typingSpeedUnit = getTypingSpeedUnit(
    getMutableConfig().typingSpeedUnit,
  );
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

  if (getMutableConfig().funbox.length > 0) {
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
          family: getMutableConfig().fontFamily.replace(/_/g, " "),
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
  getResultChartDataset("wpm").label = getMutableConfig().typingSpeedUnit;

  getResultChartDataset("raw").data = chartData2;

  getResultChartDataset("burst").data = chartData3;

  getResultChartDataset("error").data = chartData.err;
  getResultChartScale("error").max = Math.max(...chartData.err);

  if (chartOptions.fakeChartData) {
    applyFakeChartData();
  }
}
