import { clearWords, clearWordsBlur } from "./test-ui";
import { showResultScreen } from "../components/pages/test/result/useResultScreen";
import type { PluginChartOptions } from "chart.js";

import { Config } from "../config/store";
import { setConfig } from "../config/setters";
import QuotesController, { Quote } from "../controllers/quotes-controller";
import * as DB from "../db";

import {
  showNoticeNotification,
  showSuccessNotification,
} from "../states/notifications";
import { getCustomTextIndicator, isAuthenticated } from "../states/core";
import { getQuoteStats } from "../states/quote-rate";
import * as GlarsesMode from "../states/glarses-mode";
import * as SlowTimer from "../states/slow-timer";
import * as Misc from "../utils/misc";
import * as Numbers from "@oxytype/util/numbers";
import * as Arrays from "../utils/arrays";
import { get as getTypingSpeedUnit } from "../utils/typing-speed-units";
import * as TodayTracker from "./today-tracker";
import { configEvent } from "../events/config";
import * as Focus from "./focus";
import * as CustomText from "./custom-text";
import * as Funbox from "./funbox/funbox";
import type {
  AnnotationOptions,
  LabelPosition,
} from "chartjs-plugin-annotation";
import { CompletedEvent } from "@oxytype/schemas/results";
import { getActiveFunboxes } from "./funbox/list";
import { getFunbox } from "@oxytype/funbox";
import {
  getLocalTagPB,
  saveLocalTagPB,
  type TagItem,
  __nonReactive,
} from "../collections/tags";
import { canQuickRestart as canQuickRestartFn } from "../utils/quick-restart";
import { LocalStorageWithSchema } from "../utils/local-storage-with-schema";
import { z } from "zod/v3";
import { blurInputElement } from "../input/input-element";
import * as ConnectionState from "../states/connection";
import { getTheme } from "../states/theme";
import {
  getLastEventLog,
  getCurrentQuote,
  getKoreanStatus,
  getResultVisible,
  isTestInvalid,
  setResultCalculating,
  setResultLoading,
} from "../states/test";
import {
  getAccuracy,
  getCorrectedWordsHistory,
  getInputHistory,
  getRawHistory,
  getTimerBoundaryLabels,
  getWordBurstHistory,
} from "./events/stats";
import * as TestWords from "./test-words";
import { buildWordsHistory } from "./word-markup";
import {
  getResultChart,
  prepareResultChart,
  getResultChartDataset,
  getResultChartScale,
  resultState,
  setResultState,
  type ResultChartLegendId,
  type ResultCrownType,
  type ResultTag,
} from "../states/result";
import {
  buildCrown,
  buildResultStats,
  buildSpeedStats,
  type CanGetPb,
} from "./result-view-model";

let result: CompletedEvent;
let minChartVal: number;
let maxChartVal: number;

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

let resultAnnotation: AnnotationOptions<"line">[] = [];

async function updateChartData(): Promise<void> {
  const { Chart } = await import("chart.js");
  const eventLog = getLastEventLog();
  if (result.chartData === "toolong" || eventLog === null) {
    getResultChartDataset("wpm").data = [];
    getResultChartDataset("raw").data = [];
    getResultChartDataset("burst").data = [];
    getResultChartDataset("error").data = [];
    return;
  }

  const typingSpeedUnit = getTypingSpeedUnit(Config.typingSpeedUnit);
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

  if (Config.funbox.length > 0) {
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
          family: Config.fontFamily.replace(/_/g, " "),
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
  getResultChartDataset("wpm").label = Config.typingSpeedUnit;

  getResultChartDataset("raw").data = chartData2;

  getResultChartDataset("burst").data = chartData3;

  getResultChartDataset("error").data = result.chartData.err;
  getResultChartScale("error").max = Math.max(...result.chartData.err);

  if (useFakeChartData) {
    applyFakeChartData();
  }
}

function applyFakeChartData(): void {
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

  const typingSpeedUnit = getTypingSpeedUnit(Config.typingSpeedUnit);

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

  maxChartVal = Math.max(
    ...[
      Math.max(...chartData1),
      Math.max(...chartData2),
      Math.max(...chartData3),
    ],
  );

  let minChartVal = 0;

  if (!Config.startGraphsAtZero) {
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
  getResultChartDataset("wpm").label = Config.typingSpeedUnit;
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

async function updateChartPBLine(): Promise<void> {
  const { Chart } = await import("chart.js");
  const themecolors = getTheme();
  const localPb = DB.getLocalPB(
    result.mode,
    result.mode2,
    result.punctuation ?? false,
    result.numbers ?? false,
    result.language,
    result.difficulty,
    result.lazyMode ?? false,
    getFunbox(result.funbox),
  );
  const localPbWpm = localPb?.wpm ?? 0;
  if (localPbWpm === 0) return;
  const typingSpeedUnit = getTypingSpeedUnit(Config.typingSpeedUnit);
  const chartlpb = Numbers.roundTo2(
    typingSpeedUnit.fromWpm(localPbWpm),
  ).toFixed(2);
  resultAnnotation.push({
    display: true,
    type: "line",
    id: "lpb",
    scaleID: "wpm",
    value: chartlpb,
    borderColor: `${themecolors.sub}55`,
    borderWidth: 1,
    // borderDash: [4, 16],
    label: {
      backgroundColor: themecolors.sub,
      font: {
        family: Config.fontFamily.replace(/_/g, " "),
        size: 11,
        style: "normal",
        weight: Chart.defaults.font.weight,
        lineHeight: Chart.defaults.font.lineHeight as number,
      },
      color: themecolors.bg,
      padding: 3,
      borderRadius: 3,
      position: "center",
      content: ` PB: ${chartlpb} `,
      display: true,
    },
  });
}

function getEventLogAccuracy(): { correct: number; incorrect: number } | null {
  const eventLog = getLastEventLog();
  return eventLog === null ? null : getAccuracy(eventLog);
}

export function updateTodayTracker(): void {
  setResultState("timeToday", TodayTracker.getString());
}

export function showCrown(type: ResultCrownType): void {
  setResultState("crown", { visible: true, type });
}

function updateCrownText(text: string, wide = false): void {
  setResultState("crown", { text, wide });
}

async function updateCrown(dontSave: boolean): Promise<void> {
  if (Config.mode === "quote" || dontSave) {
    hideCrown();
    return;
  }

  const canGetPb = await resultCanGetPb();

  console.debug("Result can get PB:", canGetPb.value, canGetPb.reason ?? "");

  const localPb = DB.getLocalPB(
    Config.mode,
    result.mode2,
    Config.punctuation,
    Config.numbers,
    Config.language,
    Config.difficulty,
    Config.lazyMode,
    canGetPb.value ? getActiveFunboxes() : [],
  );
  const localPbWpm = localPb?.wpm ?? 0;
  const pbDiff = result.wpm - localPbWpm;
  console.debug("Local PB", localPb, "diff", pbDiff);

  const crown = buildCrown(canGetPb, pbDiff);
  if (crown === null) {
    hideCrown();
    console.debug("Hiding crown");
    return;
  }
  console.debug(`Showing ${crown.type} crown`);
  showCrown(crown.type);
  updateCrownText(crown.text, crown.wide);
}

function hideCrown(): void {
  setResultState("crown", { visible: false, text: "", wide: false });
}

export function showErrorCrownIfNeeded(): void {
  if (resultState.crown.type !== "pending") return;
  showCrown("error");
  updateCrownText(
    `Local PB data is out of sync with the server - please refresh (pb mismatch)`,
    true,
  );
}

async function resultCanGetPb(): Promise<CanGetPb> {
  const funboxes = result.funbox;
  const funboxObjects = getFunbox(result.funbox);
  const allFunboxesCanGetPb = funboxObjects.every((f) => f?.canGetPb);

  const funboxesOk = funboxes.length === 0 || allFunboxesCanGetPb;
  // allow stopOnError:letter to be PB only if 100% accuracy, since it doesn't affect gameplay
  const stopOnLetterTriggered =
    Config.stopOnError === "letter" && result.acc < 100;
  const notBailedOut = !result.bailedOut;

  if (funboxesOk && !stopOnLetterTriggered && notBailedOut) {
    return {
      value: true,
    };
  } else {
    if (!funboxesOk) {
      return {
        value: false,
        reason: "funbox",
      };
    }
    if (stopOnLetterTriggered) {
      return {
        value: false,
        reason: "stop on letter",
      };
    }
    if (!notBailedOut) {
      return {
        value: false,
        reason: "bailed out",
      };
    }
    return {
      value: false,
      reason: "unknown",
    };
  }
}

export async function showConfetti(): Promise<void> {
  if (SlowTimer.get()) return;
  const { default: confetti } = await import("canvas-confetti");
  const style = getComputedStyle(document.body);
  const colors = [
    style.getPropertyValue("--main-color"),
    style.getPropertyValue("--text-color"),
    style.getPropertyValue("--sub-color"),
  ];
  const duration = Date.now() + 125;

  (function f(): void {
    void confetti({
      particleCount: 5,
      angle: 60,
      spread: 75,
      origin: { x: 0 },
      colors: colors,
    });
    void confetti({
      particleCount: 5,
      angle: 120,
      spread: 75,
      origin: { x: 1 },
      colors: colors,
    });

    if (Date.now() < duration) {
      requestAnimationFrame(f);
    }
  })();
}

export function updateSavedResultId(resultId: string): void {
  setResultState("tags", "savedResultId", resultId);
}

async function updateTags(dontSave: boolean): Promise<void> {
  const { Chart } = await import("chart.js");
  const activeTags: TagItem[] = __nonReactive.getActiveTags();
  const userTagsCount = __nonReactive.getTags().length;
  const items: ResultTag[] = [];

  let annotationSide: LabelPosition = "start";
  let labelAdjust = 15;
  for (const tag of activeTags) {
    const tpb = getLocalTagPB(
      tag._id,
      Config.mode,
      result.mode2,
      Config.punctuation,
      Config.numbers,
      Config.language,
      Config.difficulty,
      Config.lazyMode,
    );
    const item: ResultTag = {
      id: tag._id,
      name: tag.name,
      ariaLabel: `PB: ${tpb}`,
      pb: false,
    };
    items.push(item);
    const typingSpeedUnit = getTypingSpeedUnit(Config.typingSpeedUnit);
    if (
      Config.mode !== "quote" &&
      !dontSave &&
      (await resultCanGetPb()).value
    ) {
      if (tpb < result.wpm) {
        //new pb for that tag
        saveLocalTagPB(
          tag._id,
          Config.mode,
          result.mode2,
          Config.punctuation,
          Config.numbers,
          Config.language,
          Config.difficulty,
          Config.lazyMode,
          result.wpm,
          result.acc,
          result.rawWpm,
          result.consistency,
        );
        item.pb = true;
        item.ariaLabel = `+${Numbers.roundTo2(result.wpm - tpb)}`;
        // console.log("new pb for tag " + tag.display);
      } else {
        const themecolors = getTheme();
        resultAnnotation.push({
          display: true,
          type: "line",
          id: "tpb",
          scaleID: "wpm",
          value: typingSpeedUnit.fromWpm(tpb),
          borderColor: `${themecolors.sub}55`,
          borderWidth: 1,
          // borderDash: [4, 16],
          label: {
            backgroundColor: themecolors.sub,
            font: {
              family: Config.fontFamily.replace(/_/g, " "),
              size: 11,
              style: "normal",
              weight: Chart.defaults.font.weight,
              lineHeight: Chart.defaults.font.lineHeight as number,
            },
            color: themecolors.bg,
            padding: 3,
            borderRadius: 3,
            position: annotationSide,
            xAdjust: labelAdjust,
            display: true,
            content: `${tag.name} PB: ${Numbers.roundTo2(
              typingSpeedUnit.fromWpm(tpb),
            ).toFixed(2)}`,
          },
        });
        if (annotationSide === "start") {
          annotationSide = "end";
          labelAdjust = -15;
        } else {
          annotationSide = "start";
          labelAdjust = 15;
        }
      }
    }
  }

  setResultState("tags", {
    visible: userTagsCount > 0,
    items,
    savedResultId: undefined,
  });
}

export function updateQuoteRating(rating: string): void {
  setResultState("quote", { rated: true, rating });
}

function updateRateQuote(randomQuote: Quote | null): void {
  if (Config.mode === "quote") {
    if (randomQuote === null) {
      console.error(
        "Failed to update quote rating button: randomQuote is null",
      );
      return;
    }

    const userqr =
      DB.getSnapshot()?.quoteRatings?.[randomQuote.language]?.[randomQuote.id];
    if (Numbers.isSafeNumber(userqr)) {
      setResultState("quote", "rated", true);
    }
    getQuoteStats(randomQuote)
      .then((quoteStats) => {
        setResultState(
          "quote",
          "rating",
          quoteStats?.average?.toFixed(1) ?? "",
        );
      })
      .catch((_e: unknown) => {
        setResultState("quote", "rating", "?");
      });
    setResultState("quote", "rateVisible", true);
  }
}

function updateQuoteFavorite(randomQuote: Quote | null): void {
  if (Config.mode !== "quote" || !isAuthenticated()) {
    setResultState("quote", "favoriteVisible", false);
    return;
  }

  if (randomQuote === null) {
    console.error(
      "Failed to update quote favorite button: randomQuote is null",
    );
    return;
  }

  setResultState("quote", {
    language: randomQuote.language,
    id: randomQuote.id.toString(),
    favorite: QuotesController.isQuoteFavorite(randomQuote),
    favoriteVisible: true,
  });
}

export function updateDailyLeaderboardRank(rank: number | undefined): void {
  setResultState("dailyLeaderboardRank", rank);
}

export function updateRetrySaving(visible: boolean): void {
  setResultState("retrySaving", visible);
}

export async function update(
  res: CompletedEvent,
  difficultyFailed: boolean,
  failReason: string,
  afkDetected: boolean,
  isRepeated: boolean,
  tooShort: boolean,
  randomQuote: Quote | null,
  dontSave: boolean,
): Promise<void> {
  await prepareResultChart();
  resultAnnotation = [];
  result = structuredClone(res);
  hideCrown();
  setResultState("wordsHistory", {
    items: [],
    visible: false,
    slideDuration: 0,
  });
  setResultState("replay", {
    visible: false,
    slideDuration: 0,
    stats: "",
    words: [],
  });
  updateRetrySaving(false);
  setResultState("quote", { rateVisible: false, rated: false, rating: "" });
  clearWordsBlur();
  blurInputElement();

  if (!ConnectionState.get()) {
    ConnectionState.showOfflineBanner();
  }

  setResultState(
    "stats",
    buildResultStats(result, {
      accuracy: getEventLogAccuracy(),
      quote: randomQuote,
      testInvalid: isTestInvalid(),
      difficultyFailed,
      failReason,
      afkDetected,
      isRepeated,
      tooShort,
    }),
  );
  updateQuoteFavorite(randomQuote);
  await updateCrown(dontSave);
  await updateChartData();
  updateResultChartDataVisibility();
  updateMinMaxChartValues();
  await updateChartPBLine();
  applyMinMaxChartValues();
  await updateTags(dontSave);

  ((getResultChart().options as PluginChartOptions<"line" | "scatter">).plugins
    .annotation.annotations as AnnotationOptions<"line">[]) = resultAnnotation;
  getResultChart().resize();

  const noStress = GlarsesMode.get();
  setResultState({
    noStress,
    loginTip: !isAuthenticated() && !noStress,
  });

  if (noStress) {
    setResultState("wordsHistory", { visible: false, slideDuration: 0 });
    setResultState("replay", { visible: false, slideDuration: 0 });

    console.log(
      `Test Completed: ${result.wpm} wpm ${result.acc}% acc ${result.rawWpm} raw ${result.consistency}% consistency`,
    );
  } else {
    if (!isAuthenticated()) {
      setResultState("quote", { rateVisible: false, reportVisible: false });
    } else {
      updateRateQuote(getCurrentQuote());
      setResultState("quote", "reportVisible", true);
    }
    updateDailyLeaderboardRank(undefined);
  }

  if (res.wpm === 0 && !difficultyFailed && res.testDuration >= 5) {
    const roundedTime = Math.round(res.testDuration);

    const messages = [
      `Congratulations. You just wasted ${roundedTime} seconds of your life by typing nothing. Be proud of yourself.`,
      `Bravo! You've managed to waste ${roundedTime} seconds and accomplish exactly zero. A true productivity icon.`,
      `That was ${roundedTime} seconds of absolutely legendary idleness. History will remember this moment.`,
      `Wow, ${roundedTime} seconds of typing... nothing. Bold. Mysterious. Completely useless.`,
      `Thank you for those ${roundedTime} seconds of utter nothingness. The keyboard needed the break.`,
      `A breathtaking display of inactivity. ${roundedTime} seconds of absolutely nothing. Powerful.`,
      `You just gave ${roundedTime} seconds of your life to the void. And the void says thanks.`,
      `Stunning. ${roundedTime} seconds of intense... whatever that wasn't. Keep it up, champ.`,
      `Is it performance art? A protest? Or just ${roundedTime} seconds of glorious nothing? We may never know.`,
      `You typed nothing for ${roundedTime} seconds. And in that moment, you became legend.`,
    ];

    void showConfetti();
    showNoticeNotification(Arrays.randomElementFromArray(messages), {
      customTitle: "Nice",
      durationMs: 15000,
      important: true,
    });
  }

  Focus.set(false);

  const canQuickRestart = canQuickRestartFn(
    Config.mode,
    Config.words,
    Config.time,
    CustomText.getData(),
    getCustomTextIndicator()?.isLong ?? false,
  );

  if (Config.alwaysShowWordsHistory && canQuickRestart && !noStress) {
    toggleResultWords(true);
  }
  void Funbox.clear();

  setResultLoading(false);
  await showResultScreen(Misc.applyReducedMotion(125));

  setResultCalculating(false);
  clearWords();
  getResultChart().resize();
}

const resultChartDataVisibility = new LocalStorageWithSchema({
  key: "resultChartDataVisibility",
  schema: z
    .object({
      raw: z.boolean(),
      burst: z.boolean(),
      errors: z.boolean(),
      pbLine: z.boolean(),
      tagPbLine: z.boolean(),
    })
    .strict(),
  fallback: {
    raw: true,
    burst: true,
    errors: true,
    pbLine: true,
    tagPbLine: true,
  },
});

function updateMinMaxChartValues(): void {
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
    const typingSpeedUnit = getTypingSpeedUnit(Config.typingSpeedUnit);
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

  if (!Config.startGraphsAtZero) {
    minChartVal = Math.min(...values);

    // Round down to nearest multiple of 10
    minChartVal = Math.floor(minChartVal / 10) * 10;
  }
}

function applyMinMaxChartValues(): void {
  getResultChartScale("wpm").min = minChartVal;
  getResultChartScale("wpm").max = maxChartVal;
  getResultChartScale("raw").min = minChartVal;
  getResultChartScale("raw").max = maxChartVal;
  getResultChartScale("burst").min = minChartVal;
  getResultChartScale("burst").max = maxChartVal;
}

function updateResultChartDataVisibility(): void {
  const vis = resultChartDataVisibility.get();
  getResultChartDataset("raw").hidden = !vis.raw;
  getResultChartDataset("burst").hidden = !vis.burst;
  getResultChartDataset("error").hidden = !vis.errors;

  for (const annotation of resultAnnotation) {
    if (annotation.id === "lpb") {
      annotation.display = vis.pbLine;
    } else if (annotation.id === "tpb") {
      annotation.display = vis.tagPbLine;
    }
  }

  // Check if there are any tag PB annotations
  const hasTagPbAnnotations = resultAnnotation.some(
    (annotation) => annotation.id === "tpb",
  );

  setResultState("chartLegend", {
    visibility: vis,
    pbLineVisible: isAuthenticated(),
    tagPbLineVisible: isAuthenticated() && hasTagPbAnnotations,
  });
}

export function updateTagsAfterEdit(
  tagIds: string[],
  tagPbIds: string[],
): void {
  const kept = resultState.tags.items.filter((tag) => tagIds.includes(tag.id));
  const added: ResultTag[] = tagIds
    .filter((id) => !kept.some((tag) => tag.id === id))
    .map((id) => ({
      id,
      name: __nonReactive.getTag(id)?.name ?? "",
      pb: tagPbIds.includes(id),
    }));

  setResultState("tags", "items", [...kept, ...added]);
}

export function toggleResultChartLegend(
  id: "scale" | ResultChartLegendId,
): void {
  if (id === "scale") {
    setConfig("startGraphsAtZero", !Config.startGraphsAtZero);
    return;
  }

  const vis = resultChartDataVisibility.get();
  vis[id] = !vis[id];
  resultChartDataVisibility.set(vis);

  updateResultChartDataVisibility();
  updateMinMaxChartValues();
  applyMinMaxChartValues();
  getResultChart().update();
}

function loadWordsHistory(): boolean {
  setResultState("wordsHistory", "items", []);

  const eventLog = getLastEventLog();
  if (eventLog === null) {
    return false;
  }

  setResultState(
    "wordsHistory",
    "items",
    buildWordsHistory({
      inputHistory: getInputHistory(eventLog),
      correctedHistory: getCorrectedWordsHistory(eventLog),
      burstHistory: getWordBurstHistory(eventLog),
      getTargetWord: (i) => TestWords.words.get(i)?.textWithCommit ?? "",
      zen: Config.mode === "zen",
      timed:
        Config.mode === "time" ||
        (Config.mode === "custom" && CustomText.getLimitMode() === "time") ||
        (Config.mode === "custom" && CustomText.getLimitValue() === 0),
      korean: getKoreanStatus(),
    }),
  );

  return true;
}

export function toggleResultWords(noAnimation = false): void {
  if (!getResultVisible()) return;

  const slideDuration = noAnimation ? 0 : 250;
  if (!resultState.wordsHistory.visible) {
    if (resultState.wordsHistory.items.length === 0) {
      loadWordsHistory();
    }
    setResultState("wordsHistory", { visible: true, slideDuration });
  } else {
    setResultState("wordsHistory", { visible: false, slideDuration });
  }
}

configEvent.subscribe(
  async ({ key }) => {
    if (
      ["typingSpeedUnit", "startGraphsAtZero"].includes(key) &&
      getResultVisible()
    ) {
      resultAnnotation = [];

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
  },
  import.meta.hot,
);
