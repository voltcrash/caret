import { createAppOwned } from "../../../../app/application";
import { appObject } from "../../../../app/state";
import { resultAnnotations } from "./context";
import { getMutableConfig } from "../../../../ts/config/store";
import { get as getTypingSpeedUnit } from "../../../../ts/utils/typing-speed-units";
import { getResultChartDataset, getResultChartScale } from "../../state/result";

const bounds = appObject(createAppOwned(() => ({ min: 0, max: 0 })));

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

  bounds.max = Math.max(...values);

  let maxAnnotation: null | number = null;
  for (const annotation of resultAnnotations()) {
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
      bounds.max >= maxAnnotation - lpbRange &&
      bounds.max <= maxAnnotation + lpbRange
    ) {
      bounds.max = Math.round(maxAnnotation + lpbRange);
    }
  }

  bounds.max = Math.ceil(bounds.max / 10) * 10;

  bounds.min = 0;

  if (!getMutableConfig().startGraphsAtZero) {
    bounds.min = Math.min(...values);

    // Round down to nearest multiple of 10
    bounds.min = Math.floor(bounds.min / 10) * 10;
  }
}

export function applyMinMaxChartValues(): void {
  getResultChartScale("wpm").min = bounds.min;
  getResultChartScale("wpm").max = bounds.max;
  getResultChartScale("raw").min = bounds.min;
  getResultChartScale("raw").max = bounds.max;
  getResultChartScale("burst").min = bounds.min;
  getResultChartScale("burst").max = bounds.max;
}
export function setMaxChartValue(value: number): void {
  bounds.max = value;
}
