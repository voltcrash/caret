import { FontName } from "@oxytype/schemas/fonts";

import { getMutableConfig } from "./config/store";
import {
  setFontFamily,
  setMediaQueryDebugLevel as setDebugLevel,
} from "./states/app";
import * as TestUI from "./test/test-ui";

let isPreviewingFont = false;
export function previewFontFamily(font: FontName): void {
  setFontFamily(
    `"${font.replaceAll(/_/g, " ")}", "Roboto Mono", "Vazirharf", "monospace"`,
  );
  void TestUI.updateHintsPositionDebounced();
  isPreviewingFont = true;
}

export { applyFontFamily } from "../app/fonts.client";

export function clearFontPreview(): void {
  if (!isPreviewingFont) return;
  previewFontFamily(getMutableConfig().fontFamily);
  isPreviewingFont = false;
}

export function setMediaQueryDebugLevel(level: number): void {
  setDebugLevel(level > 0 && level < 4 ? level : 0);
}
