import type { Config } from "@caret/schemas/configs";
import type { LayoutObject } from "@caret/schemas/layouts";

export const initialTypingCookie = "caret_typing_preview";
export const previewKeys = [
  "mode",
  "time",
  "words",
  "quoteLength",
  "punctuation",
  "numbers",
  "language",
  "fontSize",
  "fontFamily",
  "quickRestart",
  "showTestModesNotice",
  "tapeMode",
  "maxLineWidth",
  "timerStyle",
  "timerOpacity",
  "timerColor",
  "highlightMode",
  "flipTestColors",
  "colorfulMode",
  "showAllLines",
  "keymapMode",
  "keymapLayout",
  "keymapStyle",
  "keymapLegendStyle",
  "keymapKeys",
  "keymapSize",
  "layout",
] as const;

export type PreviewSettings = Pick<Config, (typeof previewKeys)[number]>;

export type InitialTypingSnapshot = {
  version: 1 | 2;
  seed: number;
  key: string;
  engineHash: string;
  words: string[];
  settings: PreviewSettings;
  keymapLayout?: LayoutObject;
};

export function previewSettings(config: Config): PreviewSettings {
  return Object.fromEntries(
    previewKeys.map((key) => [key, config[key]]),
  ) as PreviewSettings;
}
