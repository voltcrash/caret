import { LANGUAGE_NAMES } from "@caret/schemas/language-names";
import type { Language } from "@caret/schemas/languages";
import type { Client, Mode } from "@caret/schemas/shared";

export const pageSize = 50;
export const maxPageIndex = 100_000;

export type SpeedSelection = {
  client?: Client;
  type: "daily" | "allTime";
  previous: boolean;
  mode: Mode;
  mode2: string;
  language: Language;
};

export type XpSelection = {
  client?: Client;
  type: "weekly";
  previous: boolean;
  language?: never;
  mode?: never;
  mode2?: never;
};

export type Selection = SpeedSelection | XpSelection;
export type LeaderboardType = Selection["type"];

export const defaultSelection: Selection = {
  type: "allTime",
  mode: "time",
  mode2: "15",
  language: "english",
  previous: false,
};

export type LeaderboardUrlParams = {
  client?: Client;
  type?: LeaderboardType;
  mode?: Mode;
  mode2?: string;
  language?: Language;
  yesterday?: boolean;
  lastWeek?: boolean;
  page?: number;
  goToUserPage?: boolean;
};

export type LeaderboardView = {
  selection: Selection;
  /** 0-based. */
  page: number;
  goToUserPage: boolean;
};

const validTypes = new Set<string>(["allTime", "daily", "weekly"]);
const validModes = new Set<string>(["time", "words", "quote", "custom", "zen"]);
const validLanguages = new Set<string>(LANGUAGE_NAMES);

function asString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function parseBoolParam(raw: unknown): boolean | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "boolean") return raw;
  const value = asString(raw);
  return value === "t" || value === "true";
}

/** Validate `/leaderboards` URL params without pulling zod into the eager route bundle. */
export function parseLeaderboardSearch(
  search: Record<string, unknown>,
): LeaderboardUrlParams {
  const cleared: LeaderboardUrlParams = {
    client: undefined,
    type: undefined,
    mode: undefined,
    mode2: undefined,
    language: undefined,
    yesterday: undefined,
    lastWeek: undefined,
    page: undefined,
    goToUserPage: undefined,
  };
  let client: Client | undefined;
  if (search["client"] !== undefined && search["client"] !== null) {
    const value = asString(search["client"]);
    if (value !== "web") return cleared;
    client = "web";
  }
  let type: LeaderboardType | undefined;
  if (search["type"] !== undefined && search["type"] !== null) {
    const value = asString(search["type"]);
    if (value === undefined || !validTypes.has(value)) return cleared;
    type = value as LeaderboardType;
  }
  let mode: Mode | undefined;
  if (search["mode"] !== undefined && search["mode"] !== null) {
    const value = asString(search["mode"]);
    if (value === undefined || !validModes.has(value)) return cleared;
    mode = value as Mode;
  }
  let mode2: string | undefined;
  if (search["mode2"] !== undefined && search["mode2"] !== null) {
    mode2 = asString(search["mode2"]);
    if (mode2 === undefined) return cleared;
  }
  let language: Language | undefined;
  if (search["language"] !== undefined && search["language"] !== null) {
    const value = asString(search["language"]);
    if (value === undefined || !validLanguages.has(value)) return cleared;
    language = value as Language;
  }
  let page: number | undefined;
  if (search["page"] !== undefined && search["page"] !== null) {
    const raw = asString(search["page"]);
    if (raw === undefined) return cleared;
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return cleared;
    page = parsed;
  }
  return {
    client,
    type,
    mode,
    mode2,
    language,
    yesterday: parseBoolParam(search["yesterday"]),
    lastWeek: parseBoolParam(search["lastWeek"]),
    page,
    goToUserPage: parseBoolParam(search["goToUserPage"]),
  };
}

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
    page: pageIndexFromUrl(params.page),
  };
}

function pageIndexFromUrl(page = 1): number {
  if (!Number.isInteger(page) || page < 1 || page > maxPageIndex + 1) {
    return 0;
  }
  return page - 1;
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
