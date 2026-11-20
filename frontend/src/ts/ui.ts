import { FontName } from "@caret/schemas/fonts";

import { createAppOwned } from "../app/application";
import { appObject } from "../app/state";
import { peekConfig } from "./config/store";
import {
  setFontFamily,
  setMediaQueryDebugLevel as setDebugLevel,
} from "./states/app";
import { updateTestHints } from "./typing-host";

const fontPreview = appObject(createAppOwned(() => ({ active: false })));
export function previewFontFamily(font: FontName): void {
  setFontFamily(
    `"${font.replaceAll(/_/g, " ")}", "Roboto Mono", "Vazirharf", "monospace"`,
  );
  updateTestHints();
  fontPreview.active = true;
}

export { applyFontFamily } from "../app/fonts.client";

export function clearFontPreview(): void {
  if (!fontPreview.active) return;
  previewFontFamily(peekConfig().fontFamily);
  fontPreview.active = false;
}

export function setMediaQueryDebugLevel(level: number): void {
  setDebugLevel(level > 0 && level < 4 ? level : 0);
}
