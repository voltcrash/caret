import type { Config } from "@caret/schemas/configs";
export const lastConfigsToApply: ReadonlySet<keyof Config> = new Set<
  keyof Config
>([
  "keymapMode",
  "minWpm",
  "minAcc",
  "minBurst",
  "paceCaret",
  "quoteLength", //quote length sets mode,
  "words",
  "time",
  "mode", // mode sets punctuation and numbers
  "numbers",
  "punctuation",
  "funbox",
]);
