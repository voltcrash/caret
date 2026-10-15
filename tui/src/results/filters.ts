import { z } from "zod";
import { DifficultySchema, FunboxNameSchema } from "@oxytype/schemas/configs";
import { LanguageSchema } from "@oxytype/schemas/languages";
import { ModeSchema } from "@oxytype/schemas/shared";
import type { ResultMinified } from "@oxytype/schemas/results";
import type { LocalResult } from "../test/typing-test";

export const historyFiltersSchema = z
  .object({
    mode: ModeSchema.optional(),
    mode2: z.string().optional(),
    language: LanguageSchema.optional(),
    difficulty: DifficultySchema.optional(),
    punctuation: z.boolean().optional(),
    numbers: z.boolean().optional(),
    pb: z.boolean().optional(),
    offline: z.boolean().optional(),
    tag: z.string().optional(),
    funbox: FunboxNameSchema.optional(),
    after: z.number().int().nonnegative().optional(),
    before: z.number().int().nonnegative().optional(),
  })
  .strict();
export type HistoryFilters = z.infer<typeof historyFiltersSchema>;

export function matchesFilters(
  result: ResultMinified | LocalResult,
  filters: HistoryFilters,
): boolean {
  for (const key of [
    "mode",
    "mode2",
    "language",
    "difficulty",
    "punctuation",
    "numbers",
    "offline",
  ] as const) {
    if (
      filters[key] !== undefined &&
      (result[key] ??
        (key === "language"
          ? "english"
          : key === "difficulty"
            ? "normal"
            : false)) !== filters[key]
    ) {
      return false;
    }
  }
  if (
    filters.pb !== undefined &&
    ("isPb" in result && result.isPb === true) !== filters.pb
  ) {
    return false;
  }
  if (filters.tag !== undefined && !result.tags?.includes(filters.tag)) {
    return false;
  }
  if (
    filters.funbox !== undefined &&
    !result.funbox?.includes(filters.funbox)
  ) {
    return false;
  }
  return (
    (filters.after === undefined || result.timestamp >= filters.after) &&
    (filters.before === undefined || result.timestamp <= filters.before)
  );
}
