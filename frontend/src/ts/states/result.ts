import { createAppOwned } from "../../app/application";
import { createAppStore, createAppSignal } from "../../app/state";
import type { CartesianScaleOptions, Chart, ChartDataset } from "chart.js";

import { Language } from "@oxytype/schemas/languages";
import { TypingSpeedUnit } from "@oxytype/schemas/configs";
import type { WordsHistoryItem } from "../test/word-markup";
import { createEvent } from "../hooks/createEvent";
import type { ReplayWord } from "@oxytype/typing-core/replay";
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

export const [resultState, setResultState] = createAppStore<ResultState>({
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

export function bindResultChartLoader(loader: () => Promise<void>): () => void {
  const state = resultRefs();
  state.chartLoader = loader;
  return () => {
    if (state.chartLoader === loader) state.chartLoader = undefined;
  };
}

export async function prepareResultChart(): Promise<void> {
  const state = resultRefs();
  await state.chartLoader?.();
}

export async function waitForResultChart(): Promise<void> {
  const state = resultRefs();
  if (state.resultChart !== undefined) return;
  await new Promise<void>((resolve) => state.chartWaiters.add(resolve));
}

export function setResultChart(chart: ResultChartType | undefined): void {
  const state = resultRefs();
  state.resultChart = chart;
  if (chart !== undefined) {
    for (const resolve of state.chartWaiters) resolve();
    state.chartWaiters.clear();
  }
}

export function getResultChart(): ResultChartType {
  const state = resultRefs();
  if (state.resultChart === undefined) {
    throw new Error("Result chart is not mounted");
  }
  return state.resultChart;
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
  createAppSignal<ScreenshotWatermark>();

// set by Result once mounted; result.ts, test-ui and test-screenshot still
// show/hide, animate and measure these imperatively

export function bindResultScreenLoader(
  loader: () => Promise<void>,
): () => void {
  const state = resultRefs();
  state.screenLoader = loader;
  return () => {
    if (state.screenLoader === loader) state.screenLoader = undefined;
  };
}

export async function prepareResultScreen(): Promise<void> {
  const state = resultRefs();
  await state.screenLoader?.();
}

export async function waitForResultScreen(): Promise<void> {
  const state = resultRefs();
  if (state.resultElement !== undefined) return;
  await new Promise<void>((resolve) => state.screenWaiters.add(resolve));
}

export function setResultElements(
  result: HTMLDivElement,
  wrapper: HTMLDivElement,
): () => void {
  const state = resultRefs();
  state.resultElement = result;
  state.resultWrapperElement = wrapper;
  for (const resolve of state.screenWaiters) resolve();
  state.screenWaiters.clear();
  return () => {
    if (state.resultElement === result) {
      state.resultElement = undefined;
      state.resultWrapperElement = undefined;
    }
  };
}

// #result
export function getResultElement(): HTMLDivElement | undefined {
  const state = resultRefs();
  return state.resultElement;
}

// #result .wrapper, the screenshot area
export function getResultWrapperElement(): HTMLDivElement | undefined {
  const state = resultRefs();
  return state.resultWrapperElement;
}

const resultRefs = createAppOwned(() => ({
  resultChart: undefined as ResultChartType | undefined,
  chartLoader: undefined as (() => Promise<void>) | undefined,
  chartWaiters: new Set<() => void>(),
  resultElement: undefined as HTMLDivElement | undefined,
  resultWrapperElement: undefined as HTMLDivElement | undefined,
  screenLoader: undefined as (() => Promise<void>) | undefined,
  screenWaiters: new Set<() => void>(),
}));
