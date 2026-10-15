import { applyFakeChartData } from "./fake-chart";
import { result, resultAnnotation } from "./context";
import { getMutableConfig } from "../../config/store";
import { showSuccessNotification } from "../../states/notifications";
import * as Numbers from "@oxytype/util/numbers";
import * as Arrays from "../../utils/arrays";
import { get as getTypingSpeedUnit } from "../../utils/typing-speed-units";
import { getActiveFunboxes } from "../funbox/list";
import { getTheme } from "../../states/theme";
import { getLastEventLog, getResultVisible } from "../../states/test";
import {
  getRawHistory,
  getTimerBoundaryLabels,
} from "@oxytype/typing-core/events/stats";
import {
  getResultChart,
  getResultChartDataset,
  getResultChartScale,
} from "../../states/result";

let useSmoothedBurst = true;

let useFakeChartData = false;

export function toggleSmoothedBurst(): void {
  useSmoothedBurst = !useSmoothedBurst;
  showSuccessNotification(useSmoothedBurst ? "on" : "off");
  if (getResultVisible()) {
    void updateChartData().then(() => {
      getResultChart().update("resize");
    });
  }
}

export function toggleUserFakeChartData(): void {
  useFakeChartData = !useFakeChartData;
  showSuccessNotification(useFakeChartData ? "on" : "off");
  if (getResultVisible()) {
    void updateChartData().then(() => {
      getResultChart().update("resize");
    });
  }
}

export async function updateChartData(): Promise<void> {
  const { Chart } = await import("chart.js");
  const eventLog = getLastEventLog();
  if (result.chartData === "toolong" || eventLog === null) {
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
    ...result.chartData.wpm.map((a) =>
      Numbers.roundTo2(typingSpeedUnit.fromWpm(a)),
    ),
  ];

  const chartData2 = getRawHistory(eventLog).map((a) =>
    Numbers.roundTo2(typingSpeedUnit.fromWpm(a)),
  );

  const valueWindow = Math.max(...result.chartData.burst) * 0.25;
  let smoothedBurst = Arrays.smoothWithValueWindow(
    result.chartData.burst,
    1,
    useSmoothedBurst ? valueWindow : 0,
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
    resultAnnotation.push({
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

  getResultChartDataset("error").data = result.chartData.err;
  getResultChartScale("error").max = Math.max(...result.chartData.err);

  if (useFakeChartData) {
    applyFakeChartData();
  }
}
