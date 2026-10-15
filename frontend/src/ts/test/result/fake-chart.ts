import { setMaxChartValue } from "./chart-bounds";
import { getMutableConfig } from "../../config/store";
import * as Numbers from "@oxytype/util/numbers";
import { get as getTypingSpeedUnit } from "../../utils/typing-speed-units";
import {
  getResultChart,
  getResultChartDataset,
  getResultChartScale,
} from "../../states/result";

export function applyFakeChartData(): void {
  const fakeChartData = {
    wpm: [
      108, 120, 116, 114, 113, 120, 118, 121, 119, 120, 116, 118, 113, 110, 108,
      110, 107, 107, 108, 109, 110, 112, 114, 112, 111, 109, 110, 108, 108, 109,
    ],
    raw: [
      108, 120, 116, 114, 113, 120, 123, 127, 131, 131, 131, 132, 130, 133, 134,
      134, 131, 129, 129, 128, 129, 130, 131, 129, 129, 127, 127, 128, 127, 127,
    ],
    burst: [
      108, 132, 108, 108, 108, 156, 144, 156, 156, 132, 132, 144, 108, 168, 156,
      132, 96, 108, 120, 120, 144, 156, 144, 84, 132, 84, 132, 156, 108, 120,
    ],
    err: [
      0, 0, 0, 0, 0, 0, 3, 1, 3, 0, 5, 0, 3, 5, 4, 0, 2, 0, 0, 0, 0, 0, 0, 1, 2,
      1, 0, 4, 0, 0,
    ],
  };

  const labels = fakeChartData.wpm.map((_, i) => (i + 1).toString());

  const typingSpeedUnit = getTypingSpeedUnit(
    getMutableConfig().typingSpeedUnit,
  );

  const chartData1 = [
    ...fakeChartData.wpm.map((a) =>
      Numbers.roundTo2(typingSpeedUnit.fromWpm(a)),
    ),
  ];

  const chartData2 = [
    ...fakeChartData.raw.map((a) =>
      Numbers.roundTo2(typingSpeedUnit.fromWpm(a)),
    ),
  ];

  const chartData3 = [
    ...fakeChartData.burst.map((a) =>
      Numbers.roundTo2(typingSpeedUnit.fromWpm(a)),
    ),
  ];

  const maxChartVal = Math.max(
    ...[
      Math.max(...chartData1),
      Math.max(...chartData2),
      Math.max(...chartData3),
    ],
  );

  setMaxChartValue(maxChartVal);

  let minChartVal = 0;

  if (!getMutableConfig().startGraphsAtZero) {
    minChartVal = Math.min(
      ...[
        Math.min(...chartData1),
        Math.min(...chartData2),
        Math.min(...chartData3),
      ],
    );

    // Round down to nearest multiple of 10
    minChartVal = Math.floor(minChartVal / 10) * 10;
  }

  getResultChart().data.labels = labels;

  getResultChartDataset("wpm").data = chartData1;
  getResultChartDataset("wpm").label = getMutableConfig().typingSpeedUnit;
  getResultChartScale("wpm").min = minChartVal;
  getResultChartScale("wpm").max = maxChartVal;

  getResultChartDataset("raw").data = chartData2;
  getResultChartScale("raw").min = minChartVal;
  getResultChartScale("raw").max = maxChartVal;

  getResultChartDataset("burst").data = chartData3;
  getResultChartScale("burst").min = minChartVal;
  getResultChartScale("burst").max = maxChartVal;

  getResultChartDataset("error").data = fakeChartData.err;
  getResultChartScale("error").max = Math.max(...fakeChartData.err);
}
