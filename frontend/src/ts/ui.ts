import { FontName } from "@oxytype/schemas/fonts";

import { getMutableConfig } from "./config/store";
import {
  setFontFace,
  setFontFamily,
  setMediaQueryDebugLevel as setDebugLevel,
} from "./states/app";
import * as TestUI from "./test/test-ui";
import fileStorage from "./utils/file-storage";
import { getLanguage } from "./utils/json-data";
import { replaceUnderscoresWithSpaces } from "./utils/strings";

let isPreviewingFont = false;
export function previewFontFamily(font: FontName): void {
  setFontFamily(
    `"${font.replaceAll(/_/g, " ")}", "Roboto Mono", "Vazirharf", "monospace"`,
  );
  void TestUI.updateHintsPositionDebounced();
  isPreviewingFont = true;
}

export async function applyFontFamily(): Promise<void> {
  let font = replaceUnderscoresWithSpaces(getMutableConfig().fontFamily);

  const localFont = await fileStorage.getFile("LocalFontFamilyFile");
  if (localFont === undefined) {
    //use config font
    setFontFace("");
  } else {
    font = "LOCALCUSTOM";

    setFontFace(`
      @font-face{ 
        font-family: LOCALCUSTOM;
        src: url(${localFont});
        font-weight: 400;
        font-style: normal;
        font-display: block;
      }`);
  }

  const preferredFont = (await getLanguage(getMutableConfig().language))
    ?.preferredFont;

  const fonts = [
    `"${font}"`,
    preferredFont !== undefined
      ? `"${replaceUnderscoresWithSpaces(preferredFont)}"`
      : undefined,
    '"Roboto Mono"',
    '"Vazirharf"',
    "monospace",
  ].filter((it) => it !== undefined);

  setFontFamily(fonts.join(","));
}

export function clearFontPreview(): void {
  if (!isPreviewingFont) return;
  previewFontFamily(getMutableConfig().fontFamily);
  isPreviewingFont = false;
}

export function setMediaQueryDebugLevel(level: number): void {
  setDebugLevel(level > 0 && level < 4 ? level : 0);
}
