import type { KnownFontName } from "@caret/schemas/fonts";

import { Fonts } from "../ts/constants/fonts";
import { captureApplication } from "./application";
import { peekConfig } from "../ts/config/store";
import { setFontFace, setFontFamily } from "../ts/states/app";
import fileStorage from "../ts/utils/file-storage";
import { getLanguage } from "../ts/utils/json-data";
import { replaceUnderscoresWithSpaces } from "../ts/utils/strings";

const startupFonts = new Set(["Roboto_Mono", "Lexend_Deca"]);
const STARTUP_FONT_FACE_KEY = "startupFontFace";

function webFontFaceRule(name: string): string {
  if (startupFonts.has(name) || !Object.hasOwn(Fonts, name)) return "";
  const entry = Fonts[name as KnownFontName];
  if (entry.systemFont) return "";
  const family = replaceUnderscoresWithSpaces(name);
  return `@font-face{font-family:${JSON.stringify(family)};font-style:normal;font-weight:${entry.weight ?? 400};font-display:swap;src:url("/webfonts/${entry.fileName}") format("woff2");}`;
}

function saveStartupFontFace(name: string): void {
  try {
    if (startupFonts.has(name) || !Object.hasOwn(Fonts, name)) {
      localStorage.removeItem(STARTUP_FONT_FACE_KEY);
      return;
    }
    const entry = Fonts[name as KnownFontName];
    if (entry.systemFont) {
      localStorage.removeItem(STARTUP_FONT_FACE_KEY);
      return;
    }
    localStorage.setItem(
      STARTUP_FONT_FACE_KEY,
      JSON.stringify({
        family: replaceUnderscoresWithSpaces(name),
        fileName: entry.fileName,
        weight: entry.weight ?? 400,
      }),
    );
  } catch {
    // storage may be full or unavailable
  }
}

export async function applyFontFamily(): Promise<void> {
  const lease = captureApplication();
  const config = peekConfig();
  const selectedFont = config.fontFamily;
  const language = config.language;
  let font = replaceUnderscoresWithSpaces(selectedFont);

  const [localFont, languageData] = await Promise.all([
    fileStorage.getFile("LocalFontFamilyFile"),
    language === "english" ? Promise.resolve(undefined) : getLanguage(language),
  ]);
  const preferredFont = languageData?.preferredFont;
  lease.assertCurrent();
  if (selectedFont !== config.fontFamily || language !== config.language) {
    return;
  }
  const extraRules: string[] = [];
  if (localFont === undefined) {
    const selectedRule = webFontFaceRule(selectedFont);
    if (selectedRule !== "") extraRules.push(selectedRule);
    saveStartupFontFace(selectedFont);
  } else {
    font = "LOCALCUSTOM";
    saveStartupFontFace("Roboto_Mono");
    extraRules.push(`
      @font-face{ 
        font-family: LOCALCUSTOM;
        src: url(${localFont});
        font-weight: 400;
        font-style: normal;
        font-display: block;
      }`);
  }
  if (preferredFont !== undefined && preferredFont !== selectedFont) {
    const preferredRule = webFontFaceRule(preferredFont);
    if (preferredRule !== "") extraRules.push(preferredRule);
  }
  setFontFace(extraRules.join("\n"));
  document.getElementById("fontBootstrap")?.remove();

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
