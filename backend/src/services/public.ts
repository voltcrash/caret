import type { TypingStats } from "@oxytype/schemas/public";
import { TypingStatsSchema } from "@oxytype/schemas/public";
import { getTypingStats } from "../dal/public";

/** Only the web aggregate DTO crosses the application transport boundary. */
export async function readTypingStats(): Promise<TypingStats> {
  return TypingStatsSchema.parse(await getTypingStats("web"));
}
