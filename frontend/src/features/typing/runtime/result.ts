import { captureTypingRoute } from "../scope";
import { updateTags } from "./result/tags";
export { updateSavedResultId, updateTagsAfterEdit } from "./result/tags";
import { updateResultChartDataVisibility } from "./result/chart-visibility";
export { toggleResultChartLegend } from "./result/chart-visibility";
import { updateChartPBLine } from "./result/chart-pb";
import { updateChartData } from "./result/chart-data";
export {
  toggleSmoothedBurst,
  toggleUserFakeChartData,
} from "./result/chart-data";

import {
  updateMinMaxChartValues,
  applyMinMaxChartValues,
} from "./result/chart-bounds";

import { updateRateQuote, updateQuoteFavorite } from "./result/quotes";
export { updateQuoteRating } from "./result/quotes";
import { toggleResultWords } from "./result/history";
export { toggleResultWords } from "./result/history";
import { updateCrown, hideCrown } from "./result/crown";
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
import { showResultScreen } from "../components/result/useResultScreen";
import type { PluginChartOptions } from "chart.js";

import { getMutableConfig } from "../../../ts/config/store";

import { Quote } from "../../../ts/controllers/quotes-controller";

import { showNoticeNotification } from "../../../ts/states/notifications";
import {
  getCustomTextIndicator,
  isAuthenticated,
} from "../../../ts/states/core";

import * as GlarsesMode from "../../../ts/states/glarses-mode";

import * as Misc from "../../../ts/utils/misc";

import * as Arrays from "../../../ts/utils/arrays";

import * as TodayTracker from "./today-tracker";

import * as Focus from "./focus";
import * as CustomText from "./custom-text";
import * as Funbox from "./funbox/funbox";
import type { AnnotationOptions } from "chartjs-plugin-annotation";
import { CompletedEvent } from "@oxytype/schemas/results";

import { canQuickRestart as canQuickRestartFn } from "../../../ts/utils/quick-restart";

import { blurInputElement } from "../../../ts/input/input-element";
import * as ConnectionState from "../../../ts/states/connection";

import {
  getCurrentQuote,
  isTestInvalid,
  setResultCalculating,
  setResultLoading,
} from "../../../ts/states/test";

import {
  getResultChart,
  prepareResultChart,
  setResultState,
} from "../../../ts/states/result";
import { buildResultStats } from "./result-view-model";

export function updateTodayTracker(): void {
  setResultState("timeToday", TodayTracker.getString());
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
  const lease = captureTypingRoute();
  if (!lease.isCurrent()) return;
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
  updateDailyLeaderboardRank(undefined);
  setResultState("tags", "savedResultId", undefined);
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
  if (!lease.isCurrent()) return;
  // Establish pending save UI before loading the chart. A fast acknowledgement
  // must not be overwritten by late result initialization.
  await prepareResultChart();
  if (!lease.isCurrent()) return;
  await updateChartData();
  if (!lease.isCurrent()) return;
  updateResultChartDataVisibility();
  updateMinMaxChartValues();
  await updateChartPBLine();
  if (!lease.isCurrent()) return;
  applyMinMaxChartValues();
  await updateTags(dontSave);
  if (!lease.isCurrent()) return;

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
    getMutableConfig().mode,
    getMutableConfig().words,
    getMutableConfig().time,
    CustomText.getData(),
    getCustomTextIndicator()?.isLong ?? false,
  );

  if (
    getMutableConfig().alwaysShowWordsHistory &&
    canQuickRestart &&
    !noStress
  ) {
    toggleResultWords(true);
  }
  void Funbox.clear();

  setResultLoading(false);
  await showResultScreen(Misc.applyReducedMotion(125));
  if (!lease.isCurrent()) return;

  setResultCalculating(false);
  clearWords();
  getResultChart().resize();
}
