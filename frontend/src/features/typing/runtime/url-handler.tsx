import { ChallengeNameSchema } from "@caret/schemas/challenges";
import {
  CustomBackgroundFilter,
  CustomBackgroundFilterSchema,
  CustomBackgroundSize,
  CustomBackgroundSizeSchema,
  CustomThemeColors,
  CustomThemeColorsSchema,
  FunboxName,
  FunboxSchema,
} from "@caret/schemas/configs";
import { Language } from "@caret/schemas/languages";
import { CustomTextSettingsSchema } from "@caret/schemas/results";
import {
  DifficultySchema,
  Mode2Schema,
  ModeSchema,
} from "@caret/schemas/shared";
import { parseWithSchema as parseJsonWithSchema } from "@caret/util/json";
import { tryCatchSync } from "@caret/util/trycatch";
import { decompressFromURI } from "lz-ts";
import { z } from "zod";

import { setSelectedQuoteId } from "#features/typing/state/quote-selection.ts";
import { setConfig } from "#shared/config/setters.ts";
import { peekConfig } from "#shared/config/store.ts";
import {
  showErrorNotification,
  showNoticeNotification,
  showSuccessNotification,
} from "#shared/states/notifications.ts";
import * as Misc from "#shared/utils/misc.ts";

import * as ChallengeController from "./challenge-controller";
import * as CustomText from "./content/custom-text";
import { restart as restartTest } from "./test/logic";

const httpsBackgroundUrlSchema = z.string().refine((value) => {
  if (value === "") return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "Background URL must use https");

const customThemeUrlDataSchema = z.union([
  z.object({
    c: CustomThemeColorsSchema,
    i: httpsBackgroundUrlSchema.optional(),
    s: CustomBackgroundSizeSchema.optional(),
    f: CustomBackgroundFilterSchema.optional(),
  }),
  CustomThemeColorsSchema,
]);

function loadCustomThemeFromUrl(getOverride?: string): void {
  const getValue = Misc.findGetParameter("customTheme", getOverride);
  if (getValue === null) return;

  const { data: decoded, error } = tryCatchSync(() =>
    parseJsonWithSchema(atob(getValue), customThemeUrlDataSchema),
  );
  if (error) {
    console.log("Custom theme URL decoding failed", error);
    showNoticeNotification(`Failed to load theme from URL: ${error.message}`);
    return;
  }

  let colorArray: CustomThemeColors;
  let image: string | undefined;
  let size: CustomBackgroundSize | undefined;
  let filter: CustomBackgroundFilter | undefined;
  if (Array.isArray(decoded)) {
    // Backward compatibility with legacy 10-color array format.
    colorArray = decoded;
  } else {
    colorArray = decoded.c;
    image = decoded.i;
    size = decoded.s;
    filter = decoded.f;
  }

  const oldCustomTheme = peekConfig().customTheme;
  const oldCustomThemeColors = peekConfig().customThemeColors;
  try {
    setConfig("customThemeColors", colorArray, { nosave: true });
    showSuccessNotification("Custom theme applied");

    if (image !== undefined && size !== undefined && filter !== undefined) {
      setConfig("customBackground", image, { nosave: true });
      setConfig("customBackgroundSize", size, { nosave: true });
      setConfig("customBackgroundFilter", filter, { nosave: true });
    }

    if (!peekConfig().customTheme) {
      setConfig("customTheme", true, { nosave: true });
    }
  } catch (e) {
    showNoticeNotification(
      "Something went wrong. Reverting to previous state.",
    );
    console.error(e);
    setConfig("customTheme", oldCustomTheme, { nosave: true });
    setConfig("customThemeColors", oldCustomThemeColors, { nosave: true });
  }
}

const TestSettingsSchema = z.tuple([
  ModeSchema.nullable(),
  Mode2Schema.nullable(),
  CustomTextSettingsSchema.partial({
    pipeDelimiter: true,
    limit: true,
    mode: true,
  })
    //legacy values
    .extend({
      isTimeRandom: z.boolean().optional(),
      isWordRandom: z.boolean().optional(),
      word: z.number().int().optional(),
      time: z.number().int().optional(),
      delimiter: z.string().optional(),
    })
    .nullable(),
  z.boolean().nullable(), //punctuation
  z.boolean().nullable(), //numbers
  z.string().nullable(), //language
  DifficultySchema.nullable(),
  FunboxSchema.or(z.string().nullable()), //funbox as array or legacy string as hash separated values
]);

export function loadTestSettingsFromUrl(getOverride?: string): void {
  const getValue = Misc.findGetParameter("testSettings", getOverride);
  if (getValue === null) return;

  // if the encoding structure or method ever changes, make sure to support the old data format
  // otherwise eiko will be sad

  const { data: de, error } = tryCatchSync(() =>
    parseJsonWithSchema(decompressFromURI(getValue) ?? "", TestSettingsSchema),
  );
  if (error) {
    console.error("Failed to parse test settings:", error);
    showNoticeNotification(
      `Failed to load test settings from URL: ${error.message}`,
    );
    return;
  }

  const applied: Record<string, string> = {};

  if (de[0] !== null) {
    setConfig("mode", de[0], {
      nosave: true,
    });
    applied["mode"] = de[0];
  }

  const mode = de[0] ?? peekConfig().mode;
  if (de[1] !== null) {
    if (mode === "time") {
      setConfig("time", parseInt(de[1], 10), {
        nosave: true,
      });
    } else if (mode === "words") {
      setConfig("words", parseInt(de[1], 10), {
        nosave: true,
      });
    } else if (mode === "quote") {
      setConfig("quoteLength", [-2]);
      setSelectedQuoteId(parseInt(de[1], 10));
    }
    applied["mode2"] = de[1];
  }

  if (de[2] !== null) {
    const customTextSettings = de[2];
    CustomText.setText(customTextSettings.text);

    //make sure to set mode before the limit as mode also sets the limit
    CustomText.setMode(customTextSettings.mode ?? "repeat");

    if (customTextSettings.limit !== undefined) {
      CustomText.setLimitMode(customTextSettings.limit.mode);
      CustomText.setLimitValue(customTextSettings.limit.value);
    }
    //convert legacy values
    else {
      if (customTextSettings.isWordRandom) {
        CustomText.setLimitMode("word");
      } else if (customTextSettings.isTimeRandom) {
        CustomText.setLimitMode("time");
      }
      if (customTextSettings.word !== undefined) {
        CustomText.setLimitValue(customTextSettings.word);
      } else if (customTextSettings.time !== undefined) {
        CustomText.setLimitValue(customTextSettings.time);
      }
    }

    if (customTextSettings.pipeDelimiter) {
      CustomText.setPipeDelimiter(customTextSettings.pipeDelimiter);
    }
    //convert legacy values
    else if (customTextSettings.delimiter === "|") {
      CustomText.setPipeDelimiter(true);
    }

    applied["custom text settings"] = "";
  }

  if (de[3] !== null) {
    setConfig("punctuation", de[3], {
      nosave: true,
    });
    applied["punctuation"] = de[3] ? "on" : "off";
  }

  if (de[4] !== null) {
    setConfig("numbers", de[4], {
      nosave: true,
    });
    applied["numbers"] = de[4] ? "on" : "off";
  }

  if (de[5] !== null) {
    setConfig("language", de[5] as Language, {
      nosave: true,
    });
    applied["language"] = de[5];
  }

  if (de[6] !== null) {
    setConfig("difficulty", de[6], {
      nosave: true,
    });
    applied["difficulty"] = de[6];
  }

  if (de[7] !== null) {
    let val: FunboxName[] = [];
    //convert legacy values
    if (typeof de[7] === "string") {
      val = de[7].split("#") as FunboxName[];
    } else {
      val = de[7];
    }
    setConfig("funbox", val, {
      nosave: true,
    });
    applied["funbox"] = val.join(", ");
  }

  void restartTest({
    nosave: true,
  });

  const appliedEntries = Object.entries(applied).filter(
    ([, v]) => v !== undefined,
  );

  if (appliedEntries.length > 0) {
    const lines = appliedEntries.map(([key, val]) =>
      val ? `${key}: ${val}` : key,
    );
    showSuccessNotification(["Settings applied from URL:", "", ...lines], {
      durationMs: 10000,
    });
  }
}

// Challenge definitions load with the first challenge; their names are known up front.
const challengeNameLookup = Object.fromEntries(
  [...ChallengeNameSchema.values].map((name) => [name.toLowerCase(), name]),
);

async function loadChallengeFromUrl(getOverride?: string): Promise<void> {
  const getValue =
    Misc.findGetParameter("challenge", getOverride)?.toLowerCase() ?? "";
  if (getValue === "") return;

  const challengeName = challengeNameLookup[getValue];

  if (challengeName === undefined) {
    showErrorNotification(`Failed to load challenge: invalid name ${getValue}`);
    return;
  }

  ChallengeController.setup(challengeName)
    .then((result) => {
      if (result) {
        void restartTest({
          nosave: true,
        });
      }
    })
    .catch((e: unknown) => {
      showErrorNotification("Failed to load challenge");
      console.error(e);
    });
}

/** Shared theme, test-settings and challenge links; raw search keeps legacy decoding. */
export function applyUrlSettings(search: string): void {
  loadCustomThemeFromUrl(search);
  loadTestSettingsFromUrl(search);
  void loadChallengeFromUrl(search);
}
