import { createAppOwned } from "../../../app/application";
import { appObject } from "../../../app/state";
import { encodeText, decodeText } from "@oxytype/typing-engine/text";
import { getEngineSession } from "./session.client";
import * as TestWords from "./test-words";
import { showNoticeNotification } from "../../../ts/states/notifications";

import { getMutableConfig } from "../../../ts/config/store";
import { setConfig } from "../../../ts/config/setters";
import * as CustomText from "./custom-text";
import { configEvent } from "../../../ts/events/config";
import { Mode } from "@oxytype/schemas/shared";
import { CustomTextSettings } from "@oxytype/schemas/results";
import { setCustomTextIndicator } from "../../../ts/states/core";
import { getLastEventLog } from "../../../ts/states/test";

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

  const mode = before.mode ?? getMutableConfig().mode;
  const punctuation = before.punctuation ?? getMutableConfig().punctuation;
  const numbers = before.numbers ?? getMutableConfig().numbers;

  let customText = null;
  if (getMutableConfig().mode === "custom") {
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

  before.mode = mode;
  before.punctuation = punctuation;
  before.numbers = numbers;
  before.customText = customText;

  return true;
}

export function resetBefore(): void {
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
