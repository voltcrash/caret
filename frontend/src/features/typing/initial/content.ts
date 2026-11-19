import type { Config } from "@caret/typing-engine/config";

const sessionSettings = [
  "difficulty",
  "strictSpace",
  "stopOnError",
  "deleteOnError",
  "quickEnd",
  "repeatQuotes",
  "resultSaving",
  "repeatedPace",
  "freedomMode",
  "confidenceMode",
  "blindMode",
  "hideExtraLetters",
  "codeUnindentOnBackspace",
  "minBurst",
  "minBurstCustomSpeed",
  "minWpm",
  "minWpmCustomSpeed",
  "minAcc",
  "minAccCustom",
] as const satisfies readonly (keyof Config)[];
type ContentConfig = Omit<Config, (typeof sessionSettings)[number]>;

/** New engine fields participate by default; only known session rules are omitted. */
export function initialContentConfig(config: Config): ContentConfig {
  return Object.fromEntries(
    Object.entries(config).filter(
      ([key]) => !sessionSettings.some((setting) => setting === key),
    ),
  ) as ContentConfig;
}
