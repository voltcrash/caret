import { resultAnnotation } from "./context";
import { getMutableConfig } from "../../../../ts/config/store";
import { get as getTypingSpeedUnit } from "../../../../ts/utils/typing-speed-units";
import {
  getResultChartDataset,
  getResultChartScale,
} from "../../../../ts/states/result";

let minChartVal: number;

let maxChartVal: number;

export function updateMinMaxChartValues(): void {
  const values = [];

  const datasets = {
    wpm: getResultChartDataset("wpm"),
    burst: getResultChartDataset("burst"),
    raw: getResultChartDataset("raw"),
  };

  if (!datasets.wpm.hidden) {
    values.push(...datasets.wpm.data);
  }
  if (!datasets.burst.hidden) {
    values.push(...datasets.burst.data);
  }
  if (!datasets.raw.hidden) {
    values.push(...datasets.raw.data);
  }

  maxChartVal = Math.max(...values);

  let maxAnnotation: null | number = null;
  for (const annotation of resultAnnotation) {
    if ((annotation.display ?? false) === false) continue;
    if (annotation.value === undefined) continue;
    // values.push(annotation.value as number);
    if (
      maxAnnotation === null ||
      parseFloat(annotation.value as string) > maxAnnotation
    ) {
      maxAnnotation = parseFloat(annotation.value as string);
    }
  }

  if (maxAnnotation !== null) {
    const typingSpeedUnit = getTypingSpeedUnit(
      getMutableConfig().typingSpeedUnit,
    );
    const lpbRange = typingSpeedUnit.fromWpm(20);
    if (
      maxChartVal >= maxAnnotation - lpbRange &&
      maxChartVal <= maxAnnotation + lpbRange
    ) {
      maxChartVal = Math.round(maxAnnotation + lpbRange);
    }
  }

  maxChartVal = Math.ceil(maxChartVal / 10) * 10;

  minChartVal = 0;

  if (!getMutableConfig().startGraphsAtZero) {
    minChartVal = Math.min(...values);

    // Round down to nearest multiple of 10
    minChartVal = Math.floor(minChartVal / 10) * 10;
  }
}

export function applyMinMaxChartValues(): void {
  getResultChartScale("wpm").min = minChartVal;
  getResultChartScale("wpm").max = maxChartVal;
  getResultChartScale("raw").min = minChartVal;
  getResultChartScale("raw").max = maxChartVal;
  getResultChartScale("burst").min = minChartVal;
  getResultChartScale("burst").max = maxChartVal;
}
export function setMaxChartValue(value: number): void {
  maxChartVal = value;
}
