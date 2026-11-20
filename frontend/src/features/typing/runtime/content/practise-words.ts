import { createAppOwned } from "#app/application.ts";
import { appObject, createAccountSignal } from "#app/state.ts";
import { encodeText, decodeText } from "@caret/typing-engine/text";
import { getEngineSession } from "../session.client";
import * as TestWords from "../test/words";
import { showNoticeNotification } from "#shared/states/notifications.ts";

import { getConfig, peekConfig } from "#shared/config/store.ts";
import { setConfig } from "#shared/config/setters.ts";
import * as CustomText from "./custom-text";
import { configEvent } from "#shared/events/config.ts";
import { Mode } from "@caret/schemas/shared";
import { CustomTextSettings } from "@caret/schemas/results";
import { setCustomTextIndicator } from "#shared/states/core.ts";
import { getLastEventLog } from "#shared/states/test.ts";
import {
  practiceHistory,
  type PracticeWord,
} from "../../history/practice.client";

type Before = {
  mode: Mode | null;
  punctuation: boolean | null;
  numbers: boolean | null;
  customText: CustomTextSettings | null;
};

const previous = createAppOwned((): Before => ({
  mode: null,
  punctuation: null,
  numbers: null,
  customText: null,
}));
export const before = appObject(previous);

const [baseline, setBaseline] = createAccountSignal<PracticeWord[]>([]);
export const [practiceResult, setPracticeResult] = createAccountSignal<{
  context: string;
  improved?: string[];
} | null>(null);

export function improvedDrillWords(context: string): string[] | undefined {
  const targets = baseline();
  if (!targets.length || targets[0]?.context !== context) return undefined;
  const history = practiceHistory().history().words;
  return targets
    .filter((before) => {
      const after = history.find(
        (entry) => entry.word === before.word && entry.context === context,
      );
      if (!after || after.seen <= before.seen) return false;
      const oldRate = before.misses / before.seen;
      const newRate = after.misses / after.seen;
      return (
        newRate < oldRate ||
        (newRate === oldRate && before.burst > 0 && after.burst > before.burst)
      );
    })
    .map((entry) => entry.word);
}

export function weakestWords(): PracticeWord[] {
  return practiceHistory()
    .weakest(`${getConfig.language}:${getConfig.layout}`)
    .slice(0, 5);
}

export function initFromHistory(): boolean {
  const config = peekConfig();
  const selected = weakestWords();
  if (selected.length === 0) return false;
  const previous = {
    mode: before.mode ?? config.mode,
    punctuation: before.punctuation ?? config.punctuation,
    numbers: before.numbers ?? config.numbers,
    customText:
      before.customText ??
      (before.mode === null && config.mode === "custom"
        ? CustomText.getData()
        : null),
  };
  setConfig("mode", "custom", { nosave: true });
  CustomText.setPipeDelimiter(true);
  CustomText.setText(selected.map((word) => word.word));
  CustomText.setLimitMode("time");
  CustomText.setMode("shuffle");
  CustomText.setLimitValue(60);
  setCustomTextIndicator({ name: "practice", isLong: false });
  Object.assign(before, previous);
  setBaseline(selected);
  return true;
}

export function init(
  missed: "off" | "words" | "biwords",
  slow: boolean,
): boolean {
  const eventLog = getLastEventLog();
  if (eventLog === null) return false;
  const selection = getEngineSession().analyze(eventLog, {
    op: "practice",
    words: TestWords.words.get().map((word) => encodeText(word.text)),
    missed,
    slow,
    now: performance.now(),
  }).selection;
  for (const message of selection.notifications) {
    showNoticeNotification(message);
  }
  const practice = selection.result;
  if (practice === null) return false;

  const mode = before.mode ?? peekConfig().mode;
  const punctuation = before.punctuation ?? peekConfig().punctuation;
  const numbers = before.numbers ?? peekConfig().numbers;

  let customText = before.customText;
  if (
    customText === null &&
    peekConfig().mode === "custom" &&
    before.mode === null
  ) {
    customText = CustomText.getData();
  }

  setConfig("mode", "custom", {
    nosave: true,
  });
  CustomText.setPipeDelimiter(true);
  CustomText.setText(practice.text.map(decodeText));
  CustomText.setLimitMode("section");
  CustomText.setMode("shuffle");
  CustomText.setLimitValue(practice.sectionLimit);

  setCustomTextIndicator({ name: "practice", isLong: false });

  setBaseline([]);
  before.mode = mode;
  before.punctuation = punctuation;
  before.numbers = numbers;
  before.customText = customText;

  return true;
}

export function resetBefore(): void {
  setBaseline([]);
  before.mode = null;
  before.punctuation = null;
  before.numbers = null;
  before.customText = null;
}

export function usePractiseEvents(): void {
  configEvent.useListener(({ key }) => {
    if (key === "mode") resetBefore();
  });
}
