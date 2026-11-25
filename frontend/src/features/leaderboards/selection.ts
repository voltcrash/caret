import type {
  LeaderboardEntry,
  XpLeaderboardEntry,
} from "@caret/schemas/leaderboards";
import { LanguageSchema } from "@caret/schemas/languages";
import { ClientSchema, ModeSchema } from "@caret/schemas/shared";
import { z } from "zod";

export {
  applyUrlParams,
  defaultSelection,
  maxPageIndex,
  pageSize,
  urlParams,
  type LeaderboardType,
  type LeaderboardView,
  type Selection,
} from "./search";

export type LeaderboardPage = {
  count: number;
  pageSize: number;
  entries: (LeaderboardEntry | XpLeaderboardEntry)[];
  minWpm?: number;
};

const XpSelection = z.object({
  client: ClientSchema.optional(),
  type: z.literal("weekly"),
  previous: z.boolean(),
  language: z.never().optional(),
  mode: z.never().optional(),
  mode2: z.never().optional(),
});
const SpeedSelection = z.object({
  client: ClientSchema.optional(),
  type: z.enum(["daily", "allTime"]),
  previous: z.boolean(),
  mode: ModeSchema,
  mode2: z.string(),
  language: LanguageSchema,
});

export const SelectionSchema = SpeedSelection.or(XpSelection);

/** Existing `/leaderboards` URL contract (1-based page, flat values). */
export const LeaderboardUrlParamsSchema = z
  .object({
    client: ClientSchema.optional(),
    type: z.enum(["allTime", "daily", "weekly"]),
    mode: ModeSchema.optional(),
    mode2: z.string().optional(),
    language: LanguageSchema.optional(),
    yesterday: z.boolean().optional(),
    lastWeek: z.boolean().optional(),
    page: z.number().optional(),
    goToUserPage: z.boolean().optional(),
  })
  .partial();
