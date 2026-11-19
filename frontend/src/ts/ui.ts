import { FontName } from "@caret/schemas/fonts";

import { createAppOwned } from "../app/application";
import { appObject } from "../app/state";
import { getMutableConfig } from "./config/store";
import {
  setFontFamily,
  setMediaQueryDebugLevel as setDebugLevel,
} from "./states/app";
import * as TestUI from "../features/typing/runtime/test/ui";

const fontPreview = appObject(createAppOwned(() => ({ active: false })));
export function previewFontFamily(font: FontName): void {
  setFontFamily(
    `"${font.replaceAll(/_/g, " ")}", "Roboto Mono", "Vazirharf", "monospace"`,
  );
  void TestUI.updateHintsPositionDebounced();
  fontPreview.active = true;
}

export { applyFontFamily } from "../app/fonts.client";

export function clearFontPreview(): void {
  if (!fontPreview.active) return;
  previewFontFamily(getMutableConfig().fontFamily);
  fontPreview.active = false;
}

export function setMediaQueryDebugLevel(level: number): void {
  setDebugLevel(level > 0 && level < 4 ? level : 0);
}
