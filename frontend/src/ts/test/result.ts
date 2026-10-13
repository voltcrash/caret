import { applyFakeChartData } from "./result/fake-chart";
import {
  updateMinMaxChartValues,
  applyMinMaxChartValues,
} from "./result/chart-bounds";

import { updateRateQuote, updateQuoteFavorite } from "./result/quotes";
export { updateQuoteRating } from "./result/quotes";
import { toggleResultWords } from "./result/history";
export { toggleResultWords } from "./result/history";
import { updateCrown, hideCrown, resultCanGetPb } from "./result/crown";
export { showCrown, showErrorCrownIfNeeded } from "./result/crown";
import { showConfetti } from "./result/confetti";
export { showConfetti } from "./result/confetti";
import { getEventLogAccuracy } from "./result/accuracy";
import {
  result,
  resultAnnotation,
  setCurrentResult,
  resetResultAnnotations,
} from "./result/context";
import { clearWords, clearWordsBlur } from "./test-ui";
import { showResultScreen } from "../components/pages/test/result/useResultScreen";
import type { PluginChartOptions } from "chart.js";

import { Config } from "../config/store";
import { setConfig } from "../config/setters";
import { Quote } from "../controllers/quotes-controller";
import * as DB from "../db";

import {
  showNoticeNotification,
  showSuccessNotification,
} from "../states/notifications";
import { getCustomTextIndicator, isAuthenticated } from "../states/core";

import * as GlarsesMode from "../states/glarses-mode";

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
  getActiveTags,
  getLocalTagPB,
  getTag,
  getTags,
  saveLocalTagPB,
  type TagItem,
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
  getResultVisible,
  isTestInvalid,
  setResultCalculating,
  setResultLoading,
} from "../states/test";
import {
  getRawHistory,
  getTimerBoundaryLabels,
} from "@oxytype/typing-core/events/stats";

import {
  getResultChart,
  prepareResultChart,
  getResultChartDataset,
  getResultChartScale,
  resultState,
  setResultState,
  type ResultChartLegendId,
  type ResultTag,
} from "../states/result";
import { buildResultStats, buildSpeedStats } from "./result-view-model";

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

export function updateTodayTracker(): void {
  setResultState("timeToday", TodayTracker.getString());
}

export function updateSavedResultId(resultId: string): void {
  setResultState("tags", "savedResultId", resultId);
}

async function updateTags(dontSave: boolean): Promise<void> {
  const { Chart } = await import("chart.js");
  const activeTags: TagItem[] = getActiveTags();
  const userTagsCount = getTags().length;
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
  resetResultAnnotations();
  setCurrentResult(structuredClone(res));
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
      name: getTag(id)?.name ?? "",
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

configEvent.subscribe(
  async ({ key }) => {
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
