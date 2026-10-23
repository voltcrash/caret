import { Config } from "@oxytype/schemas/configs";
import { CustomTextLimitMode } from "@oxytype/schemas/util";
import { secondsToString } from "@oxytype/util/date-and-time";
import { Formatting } from "./format";

export type LiveStatsValues = {
  wpm?: number;
  acc?: number;
  raw?: number;
  burst?: number;
  seconds?: number;
};

export type CustomLimit = { mode: CustomTextLimitMode; value: number };

type ModeConfig = Pick<Config, "mode" | "time" | "words">;

/** Whether this test counts down a time limit rather than a number of words. */
export function isTimeLimitedTest(
  mode: Config["mode"],
  customLimit: CustomLimit,
): boolean {
  return mode === "time" || (mode === "custom" && customLimit.mode === "time");
}

/** Seconds the test counts down from. Only meaningful when {@link isTimeLimitedTest}. */
export function getTestTimeLimit(
  config: Pick<Config, "mode" | "time">,
  customLimit: CustomLimit,
): number {
  return config.mode === "custom" ? customLimit.value : config.time;
}

/** Words completed so far; section-limited custom text counts sections. */
export function getCurrentWordCount(input: {
  mode: Config["mode"];
  customLimit: CustomLimit;
  activeWordIndex: number;
  getSectionIndex: () => number | undefined;
}): number {
  if (input.mode === "custom" && input.customLimit.mode === "section") {
    const sectionIndex = input.getSectionIndex();
    return sectionIndex === undefined ? 0 : sectionIndex - 1;
  }
  return input.activeWordIndex;
}

export function getWordsTotal(input: {
  config: ModeConfig;
  customLimit: CustomLimit;
  /** Words in the current quote, if one is loaded. */
  quoteLength: number | undefined;
  wordsLength: number;
}): number {
  const { config } = input;
  if (config.mode === "words") return config.words;
  if (config.mode === "custom") return input.customLimit.value;
  if (config.mode === "quote") return input.quoteLength ?? 1;
  return input.wordsLength;
}

export function getLiveSpeedText(
  format: Formatting,
  blindMode: boolean,
  stats: LiveStatsValues,
): string {
  return format.typingSpeed((blindMode ? stats.raw : stats.wpm) ?? 0, {
    showDecimalPlaces: false,
  });
}

export function getLiveAccText(
  blindMode: boolean,
  stats: LiveStatsValues,
): string {
  return `${blindMode ? 100 : Math.floor(stats.acc ?? 100)}%`;
}

export function getLiveBurstText(
  format: Formatting,
  stats: LiveStatsValues,
): string {
  return format.typingSpeed(stats.burst ?? 0, { showDecimalPlaces: false });
}

/** Countdown for time-limited tests, otherwise a word counter. */
export function getTimerText(input: {
  config: ModeConfig;
  customLimit: CustomLimit;
  seconds: number | undefined;
  activeWordIndex: number;
  wordCount: number;
  wordsTotal: number;
}): string {
  const { config, customLimit } = input;
  if (isTimeLimitedTest(config.mode, customLimit)) {
    const limit = getTestTimeLimit(config, customLimit);
    const seconds = input.seconds ?? 0;
    return secondsToString(limit === 0 ? seconds : limit - seconds);
  }
  if (config.mode === "zen" || input.wordsTotal === 0) {
    return `${input.activeWordIndex}`;
  }
  return `${input.wordCount}/${input.wordsTotal}`;
}

/**
 * The flash timer styles only reveal the time every 15 seconds. Only the flash
 * styles hide, and only on time limited tests — a word counter is always shown.
 */
export function isTimerFlashHidden(
  config: Pick<Config, "mode" | "time" | "timerStyle">,
  customLimit: CustomLimit,
  seconds: number | undefined,
): boolean {
  const isFlashStyle =
    config.timerStyle === "flash_mini" || config.timerStyle === "flash_text";
  if (!isFlashStyle || !isTimeLimitedTest(config.mode, customLimit)) {
    return false;
  }
  return (getTestTimeLimit(config, customLimit) - (seconds ?? 0)) % 15 !== 0;
}
