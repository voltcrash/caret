import { Config } from "@oxytype/schemas/configs";
import { Mode2, PersonalBests } from "@oxytype/schemas/shared";
export function getMode2<M extends keyof PersonalBests>(
  config: Pick<Config, "mode" | "time" | "words">,
  randomQuote: { id: number } | null,
): Mode2<M> {
  const mode = config.mode;
  let retVal: string;

  if (mode === "time") {
    retVal = config.time.toString();
  } else if (mode === "words") {
    retVal = config.words.toString();
  } else if (mode === "custom") {
    retVal = "custom";
  } else if (mode === "zen") {
    retVal = "zen";
  } else if (mode === "quote") {
    retVal = `${randomQuote?.id ?? -1}`;
  } else {
    throw new Error("Invalid mode");
  }

  return retVal as Mode2<M>;
}
