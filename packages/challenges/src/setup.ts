import type { Challenge } from "./types";
import type { CustomTextSettings } from "@oxytype/schemas/results";
import { Config } from "@oxytype/schemas/configs";

export function challengeSetup(challenge: Challenge): {
  config: Partial<Config>;
  customText?: CustomTextSettings;
  script?: string;
} {
  const settings = challenge.settings;
  const config: Partial<Config> = { difficulty: "normal", funbox: [] };
  if (settings.type === "customTime") {
    config.mode = "time";
    config.time = settings.parameters.time;
  } else if (settings.type === "customWords") {
    config.mode = "words";
    config.words = settings.parameters.words;
  } else if (settings.type === "accuracy") {
    config.mode = "time";
    config.time = 0;
    config.difficulty = "master";
  } else if (settings.type === "funbox") {
    config.mode = settings.parameters.mode;
    config.difficulty = settings.parameters.difficulty ?? "normal";
    config.funbox = [settings.parameters.funbox];
    if (settings.parameters.mode === "time") {
      config.time = settings.parameters.mode2;
    } else if (settings.parameters.mode === "words") {
      config.words = settings.parameters.mode2;
    }
  } else if (settings.type === "customText") {
    config.mode = "custom";
    return {
      config,
      customText: {
        text: settings.parameters.text.split(" "),
        mode: settings.parameters.mode,
        limit: {
          mode: settings.parameters.limitMode,
          value: settings.parameters.limit,
        },
        pipeDelimiter: settings.parameters.isPipeDelimiter,
      },
    };
  } else if (settings.type === "script") {
    config.mode = "custom";
    if (settings.parameters.theme !== undefined) {
      config.theme = settings.parameters.theme;
    }
    config.funbox = settings.parameters.funboxes ?? [];
    return { config, script: settings.parameters.script };
  }
  if (challenge.name === "englishMaster") {
    Object.assign(config, {
      language: "english_10k",
      punctuation: true,
      numbers: true,
    });
  }
  return { config };
}
