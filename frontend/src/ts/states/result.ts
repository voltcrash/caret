import type { CartesianScaleOptions, Chart, ChartDataset } from "chart.js";
import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { Language } from "@oxytype/schemas/languages";
import { TypingSpeedUnit } from "@oxytype/schemas/configs";
import type { WordsHistoryItem } from "../test/word-markup";
import { createEvent } from "../hooks/createEvent";
import type { SupportsFlags } from "../controllers/user-flag-controller";

export type ResultCrownType =
  | "normal"
  | "ineligible"
  | "pending"
  | "error"
  | "warning";

type ResultStat = {
  text: string;
  // undefined = no hover label
  ariaLabel?: string;
};

export type ResultSpeedStats = {
  typingSpeedUnit: TypingSpeedUnit;
  wpm: ResultStat;
  raw: ResultStat;
  // balloonBreak = render the hover label on multiple lines
  acc: ResultStat & { balloonBreak: boolean };
};

export type ResultStats = ResultSpeedStats & {
  consistency: ResultStat;
  time: { text: string; afk: string; ariaLabel: string };
  characters: string;
  // lines, rendered joined with <br>
  testType: string[];
  // lines, group hidden when empty
  other: string[];
  // undefined = not a quote test, group hidden
  source: string | undefined;
};

export type ResultTag = {
  id: string;
  name: string;
  ariaLabel?: string;
  pb: boolean;
};

export type ResultChartLegendId =
  | "raw"
  | "burst"
  | "errors"
  | "pbLine"
  | "tagPbLine";

// start = not started or finished
type ReplayPlayback = "start" | "playing" | "paused";

export type ReplayLetter = {
  char: string;
  correct: boolean;
  incorrect: boolean;
  extra: boolean;
};

export type ReplayWord = {
  letters: ReplayLetter[];
  error: boolean;
};

export type ResultState = {
  stats: ResultStats | undefined;
  crown: {
    visible: boolean;
    // kept when hidden, showErrorCrownIfNeeded checks the last type
    type: ResultCrownType;
    text: string;
    wide: boolean;
  };
  tags: {
    // user has any tags
    visible: boolean;
    items: ResultTag[];
    // set once the result is saved, enables editing
    savedResultId: string | undefined;
  };
  quote: {
    language: Language | undefined;
    id: string;
    favoriteVisible: boolean;
    favorite: boolean;
    rateVisible: boolean;
    rated: boolean;
    rating: string;
    reportVisible: boolean;
  };
  chartLegend: {
    // chart data toggled on, persisted in local storage
    visibility: Record<ResultChartLegendId, boolean>;
    pbLineVisible: boolean;
    tagPbLineVisible: boolean;
  };
  wordsHistory: {
    // empty = not loaded yet, loaded when first shown
    items: WordsHistoryItem[];
    visible: boolean;
    // for the next visibility change, 0 = instant
    slideDuration: number;
  };
  replay: {
    visible: boolean;
    // for the next visibility change, 0 = instant
    slideDuration: number;
    playback: ReplayPlayback;
    stats: string;
    words: ReplayWord[];
  };
  // test language direction/script, for words history and replay
  rightToLeft: boolean;
  joiningScript: boolean;
  timeToday: string;
  dailyLeaderboardRank: number | undefined;
  loginTip: boolean;
  retrySaving: boolean;
  // glarses mode, stats replaced by a check mark
  noStress: boolean;
};

export const [resultState, setResultState] = createStore<ResultState>({
  stats: undefined,
  crown: { visible: false, type: "normal", text: "", wide: false },
  tags: { visible: false, items: [], savedResultId: undefined },
  quote: {
    language: undefined,
    id: "",
    favoriteVisible: false,
    favorite: false,
    rateVisible: false,
    rated: false,
    rating: "",
    reportVisible: false,
  },
  chartLegend: {
    visibility: {
      raw: false,
      burst: false,
      errors: false,
      pbLine: false,
      tagPbLine: false,
    },
    pbLineVisible: true,
    tagPbLineVisible: true,
  },
  wordsHistory: {
    items: [],
    visible: false,
    slideDuration: 0,
  },
  replay: {
    visible: false,
    slideDuration: 0,
    playback: "start",
    stats: "0s",
    words: [],
  },
  rightToLeft: false,
  joiningScript: false,
  timeToday: "",
  dailyLeaderboardRank: undefined,
  loginTip: false,
  retrySaving: false,
  noStress: false,
});

export type ResultChartType = Chart<"line" | "scatter", number[]>;
export type ResultChartDatasetId = "wpm" | "raw" | "error" | "burst";

// set by ResultChart once the canvas is mounted
let resultChart: ResultChartType | undefined;
let chartLoader: (() => Promise<void>) | undefined;
const chartWaiters = new Set<() => void>();

export function bindResultChartLoader(loader: () => Promise<void>): () => void {
  chartLoader = loader;
  return () => {
    if (chartLoader === loader) chartLoader = undefined;
  };
}

export async function prepareResultChart(): Promise<void> {
  await chartLoader?.();
}

export async function waitForResultChart(): Promise<void> {
  if (resultChart !== undefined) return;
  await new Promise<void>((resolve) => chartWaiters.add(resolve));
}

export function setResultChart(chart: ResultChartType | undefined): void {
  resultChart = chart;
  if (chart !== undefined) {
    for (const resolve of chartWaiters) resolve();
    chartWaiters.clear();
  }
}

export function getResultChart(): ResultChartType {
  if (resultChart === undefined) {
    throw new Error("Result chart is not mounted");
  }
  return resultChart;
}

export function getResultChartDataset(
  id: ResultChartDatasetId,
): ChartDataset<"line" | "scatter", number[]> {
  const dataset = getResultChart().data.datasets.find((x) => x.yAxisID === id);
  if (dataset === undefined) {
    throw new Error(`Result chart dataset ${id} not found`);
  }
  return dataset;
}

export function getResultChartScale(
  id: "x" | ResultChartDatasetId,
): CartesianScaleOptions {
  return getResultChart().options.scales?.[id] as CartesianScaleOptions;
}

export type ResultWordHighlightEvent =
  | { type: "highlight"; firstWordIndex: number; lastWordIndex: number }
  | { type: "hoverChart"; hovering: boolean };

// result chart hover -> words history highlight
export const resultWordHighlightEvent = createEvent<ResultWordHighlightEvent>();

export type ScreenshotWatermark = {
  date: string;
  user: { name: string; flags: SupportsFlags } | undefined;
};

// shown under the result while screenshotting
export const [getScreenshotWatermark, setScreenshotWatermark] =
  createSignal<ScreenshotWatermark>();

// set by Result once mounted; result.ts, test-ui and test-screenshot still
// show/hide, animate and measure these imperatively
let resultElement: HTMLDivElement | undefined;
let resultWrapperElement: HTMLDivElement | undefined;
let screenLoader: (() => Promise<void>) | undefined;
const screenWaiters = new Set<() => void>();

export function bindResultScreenLoader(
  loader: () => Promise<void>,
): () => void {
  screenLoader = loader;
  return () => {
    if (screenLoader === loader) screenLoader = undefined;
  };
}

export async function prepareResultScreen(): Promise<void> {
  await screenLoader?.();
}

export async function waitForResultScreen(): Promise<void> {
  if (resultElement !== undefined) return;
  await new Promise<void>((resolve) => screenWaiters.add(resolve));
}

export function setResultElements(
  result: HTMLDivElement,
  wrapper: HTMLDivElement,
): void {
  resultElement = result;
  resultWrapperElement = wrapper;
  for (const resolve of screenWaiters) resolve();
  screenWaiters.clear();
}

// #result
export function getResultElement(): HTMLDivElement | undefined {
  return resultElement;
}

// #result .wrapper, the screenshot area
export function getResultWrapperElement(): HTMLDivElement | undefined {
  return resultWrapperElement;
}
