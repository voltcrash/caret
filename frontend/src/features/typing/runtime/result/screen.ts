import { captureTypingPresentation } from "../../scope";
import { getTypingLifecycle } from "#shared/states/test-lifecycle/controller.ts";
import { updateTags } from "./tags";
export { updateSavedResultId, updateTagsAfterEdit } from "./tags";
import { updateResultChartDataVisibility } from "./chart-visibility";
export { toggleResultChartLegend } from "./chart-visibility";
import { updateChartPBLine } from "./chart-pb";
import { updateChartData } from "./chart-data";
export { toggleSmoothedBurst, toggleUserFakeChartData } from "./chart-data";

import {
  updateMinMaxChartValues,
  applyMinMaxChartValues,
} from "./chart-bounds";

import { updateRateQuote, updateQuoteFavorite } from "./quotes";
export { updateQuoteRating } from "./quotes";
import { toggleResultWords } from "./history";
export { toggleResultWords } from "./history";
import { updateCrown, hideCrown } from "./crown";
export { showCrown, showErrorCrownIfNeeded } from "./crown";
import { showConfetti } from "./confetti";
export { showConfetti } from "./confetti";
import { getEventLogAccuracy } from "./accuracy";
import {
  currentResult,
  resultAnnotations,
  setCurrentResult,
  resetResultAnnotations,
} from "./context";
import { clearWords, clearWordsBlur } from "../test/ui";
import { showResultScreen } from "../../components/result/useResultScreen";
import type { PluginChartOptions } from "chart.js";

import { peekConfig } from "#shared/config/store.ts";

import { Quote } from "../quotes-controller";

import { showNoticeNotification } from "#shared/states/notifications.ts";
import {
  getCustomTextIndicator,
  isAuthenticated,
} from "#shared/states/core.ts";

import * as GlarsesMode from "../../state/glarses-mode";

import * as Misc from "#shared/utils/misc.ts";

import * as Arrays from "#shared/utils/arrays.ts";

import * as TodayTracker from "../today-tracker";

import * as Focus from "../focus";
import * as CustomText from "../content/custom-text";
import * as Funbox from "../funbox/funbox";
import type { AnnotationOptions } from "chartjs-plugin-annotation";
import { CompletedEvent } from "@caret/schemas/results";

import { canQuickRestart as canQuickRestartFn } from "../quick-restart";

import { blurInputElement } from "#features/typing/input/input-element.ts";
import * as ConnectionState from "#shared/states/connection.ts";

import { getCurrentQuote } from "#shared/states/test.ts";
import { isTestInvalid } from "#features/typing/state/run-flags.ts";

import {
  getResultChart,
  resultState,
  prepareResultChart,
  setResultState,
} from "../../state/result";
import { buildResultStats } from "./view-model";

export function updateTodayTracker(): void {
  setResultState("timeToday", TodayTracker.getString());
}

export function updateDailyLeaderboardRank(rank: number | undefined): void {
  setResultState("dailyLeaderboardRank", rank);
}

export function updateRetrySaving(visible: boolean): void {
  setResultState("retrySaving", visible);
}

export function resetResultSaveState(): void {
  updateRetrySaving(false);
  updateDailyLeaderboardRank(undefined);
  setResultState("tags", "savedResultId", undefined);
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
  lease = captureTypingPresentation(),
): Promise<void> {
  if (!lease.isCurrent()) return;
  resetResultAnnotations();
  setCurrentResult(structuredClone(res));
  if (resultState.tags.savedResultId === undefined) hideCrown();
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
  setResultState("quote", { rateVisible: false, rated: false, rating: "" });
  clearWordsBlur();
  blurInputElement();

  if (!ConnectionState.get()) {
    ConnectionState.showOfflineBanner();
  }

  setResultState(
    "stats",
    buildResultStats(currentResult(), {
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
  if (resultState.tags.savedResultId === undefined) await updateCrown(dontSave);
  if (!lease.isCurrent()) return;
  // Establish pending save UI before loading the chart. A fast acknowledgement
  // must not be overwritten by late result initialization.
  await prepareResultChart();
  if (!lease.isCurrent()) return;
  await updateChartData();
  if (!lease.isCurrent()) return;
  await updateChartPBLine();
  if (!lease.isCurrent()) return;
  await updateTags(dontSave);
  if (!lease.isCurrent()) return;
  updateResultChartDataVisibility();
  updateMinMaxChartValues();
  applyMinMaxChartValues();

  ((getResultChart().options as PluginChartOptions<"line" | "scatter">).plugins
    .annotation.annotations as AnnotationOptions<"line">[]) =
    resultAnnotations();
  getResultChart().resize();

  const noStress = GlarsesMode.get();
  setResultState({
    noStress,
    loginTip: !isAuthenticated() && !noStress,
  });

  if (noStress) {
    setResultState("wordsHistory", { visible: false, slideDuration: 0 });
    setResultState("replay", { visible: false, slideDuration: 0 });

    const { wpm, acc, rawWpm, consistency } = currentResult();
    console.log(
      `Test Completed: ${wpm} wpm ${acc}% acc ${rawWpm} raw ${consistency}% consistency`,
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
    peekConfig().mode,
    peekConfig().words,
    peekConfig().time,
    CustomText.getData(),
    getCustomTextIndicator()?.isLong ?? false,
  );

  if (peekConfig().alwaysShowWordsHistory && canQuickRestart && !noStress) {
    toggleResultWords(true);
  }
  void Funbox.clear();

  getTypingLifecycle().send({ type: "RESULT_READY" });
  await showResultScreen(Misc.applyReducedMotion(125));
  if (!lease.isCurrent()) return;

  clearWords();
  getResultChart().resize();
}
