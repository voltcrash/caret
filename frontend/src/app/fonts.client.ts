import { captureApplication } from "./application";
import { getMutableConfig } from "../ts/config/store";
import { setFontFace, setFontFamily } from "../ts/states/app";
import fileStorage from "../ts/utils/file-storage";
import { getLanguage } from "../ts/utils/json-data";
import { replaceUnderscoresWithSpaces } from "../ts/utils/strings";

export async function applyFontFamily(): Promise<void> {
  const lease = captureApplication();
  const config = getMutableConfig();
  const selectedFont = config.fontFamily;
  const language = config.language;
  let font = replaceUnderscoresWithSpaces(selectedFont);

  const localFont = await fileStorage.getFile("LocalFontFamilyFile");
  const preferredFont = (await getLanguage(language))?.preferredFont;
  lease.assertCurrent();
  if (selectedFont !== config.fontFamily || language !== config.language) {
    return;
  }
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
