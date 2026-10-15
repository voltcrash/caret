import { buildPracticeWords } from "@oxytype/typing-core/practise-words";
import * as TestWords from "./test-words";
import { showNoticeNotification } from "../states/notifications";

import { getMutableConfig } from "../config/store";
import { setConfig } from "../config/setters";
import * as CustomText from "./custom-text";
import { configEvent } from "../events/config";
import { Mode } from "@oxytype/schemas/shared";
import { CustomTextSettings } from "@oxytype/schemas/results";
import { setCustomTextIndicator } from "../states/core";
import { getLastEventLog } from "../states/test";

type Before = {
  mode: Mode | null;
  punctuation: boolean | null;
  numbers: boolean | null;
  customText: CustomTextSettings | null;
};

export const before: Before = {
  mode: null,
  punctuation: null,
  numbers: null,
  customText: null,
};

export function init(
  missed: "off" | "words" | "biwords",
  slow: boolean,
): boolean {
  const eventLog = getLastEventLog();
  if (eventLog === null) return false;
  if (getMutableConfig().mode === "zen") return false;
  const practice = buildPracticeWords(
    eventLog,
    TestWords.words.get().map((word) => word.text),
    missed,
    slow,
    showNoticeNotification,
  );
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
  CustomText.setText(practice.text);
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
