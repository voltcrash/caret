import type {
  LeaderboardEntry,
  XpLeaderboardEntry,
} from "@oxytype/schemas/leaderboards";
import { LanguageSchema } from "@oxytype/schemas/languages";
import { ClientSchema, ModeSchema } from "@oxytype/schemas/shared";
import { z } from "zod";

export const pageSize = 50;

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
export type Selection = z.infer<typeof SelectionSchema>;
export type LeaderboardType = Selection["type"];

export const defaultSelection: Selection = {
  type: "allTime",
  mode: "time",
  mode2: "15",
  language: "english",
  previous: false,
};

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
export type LeaderboardUrlParams = z.infer<typeof LeaderboardUrlParamsSchema>;

export type LeaderboardView = {
  selection: Selection;
  /** 0-based. */
  page: number;
  goToUserPage: boolean;
};

/**
 * URL parameters over the current (stored) selection. Without `type` only a
 * client override applies and the page is kept, like the old page lifecycle.
 */
export function applyUrlParams(
  current: Selection,
  params: LeaderboardUrlParams,
  currentPage = 0,
): LeaderboardView {
  if (params.type === undefined) {
    return params.client === undefined
      ? { selection: current, page: currentPage, goToUserPage: false }
      : {
          selection: { ...current, client: params.client },
          page: 0,
          goToUserPage: false,
        };
  }
  const selection: Selection =
    params.type === "weekly"
      ? {
          ...current,
          type: "weekly",
          client: params.client ?? "web",
          previous: params.lastWeek ?? false,
          mode: undefined,
          mode2: undefined,
          language: undefined,
        }
      : {
          ...current,
          type: params.type,
          client: params.client ?? "web",
          mode: params.mode ?? "time",
          mode2: params.mode2 ?? "15",
          language: params.language ?? "english",
          previous: params.type === "daily" && (params.yesterday ?? false),
        };
  return {
    selection,
    goToUserPage: params.goToUserPage === true,
    page: params.page === undefined ? 0 : Math.max(0, params.page - 1),
  };
}

/** The URL the page writes after loading a selection. */
export function urlParams(
  selection: Selection,
  page: number,
): LeaderboardUrlParams {
  const params: LeaderboardUrlParams = {
    client: selection.client ?? "web",
    type: selection.type,
    mode: selection.mode,
    mode2: selection.mode2,
    language: selection.language,
    page: page + 1,
  };
  if (selection.type === "weekly" && selection.previous) params.lastWeek = true;
  if (selection.type === "daily" && selection.previous) params.yesterday = true;
  return params;
}
