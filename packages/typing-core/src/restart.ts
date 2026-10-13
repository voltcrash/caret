import type { Config } from "@oxytype/schemas/configs";

export function shouldRepeatQuote(
  config: Pick<Config, "mode" | "repeatQuotes">,
): boolean {
  return config.mode === "quote" && config.repeatQuotes === "typing";
}
