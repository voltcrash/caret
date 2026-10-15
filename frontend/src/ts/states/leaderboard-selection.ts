import { createAppSignal, appSignal } from "../../app/state";
import { LanguageSchema } from "@oxytype/schemas/languages";
import { ClientSchema, ModeSchema } from "@oxytype/schemas/shared";
import { Accessor, Setter } from "solid-js";
import { z } from "zod";
import { serialize as serializeUrlSearchParams } from "zod-urlsearchparams";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { replaceUrl } from "../navigation/navigation";

export const pageSize = 50;

export type LeaderboardType = Selection["type"];
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

const SelectionSchema = SpeedSelection.or(XpSelection);
export type Selection = z.infer<typeof SelectionSchema>;

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

const [getSelectionLs, setSelection] = appSignal(lsSelection);
export const [getPage, setPage] = createAppSignal(0);
export const [getGoToUserPage, setGoToUserPage] = createAppSignal(false);

export const getSelection = (): Selection => {
  return getSelectionLs();
};

export { setSelection };

export function readLeaderboardGetParameters(
  params: LeaderboardUrlParams | undefined,
): void {
  if (params?.type === undefined) {
    if (params?.client !== undefined) {
      setSelection({ ...getSelection(), client: params.client });
      setPage(0);
    }
    return;
  }

  let newSelection: Partial<Selection> = {
    type: params.type,
    client: params.client ?? "web",
  };

  if (params.type === "weekly") {
    newSelection.previous = params.lastWeek ?? false;
    newSelection.mode = undefined;
    newSelection.mode2 = undefined;
    newSelection.language = undefined;
  } else {
    newSelection.mode = params.mode ?? "time";
    newSelection.mode2 = params.mode2 ?? "15";
    newSelection.language = params.language ?? "english";
    newSelection.previous =
      params.type === "daily" && (params.yesterday ?? false);
  }

  setSelection({ ...getSelection(), ...newSelection } as Selection);

  setGoToUserPage(params.goToUserPage === true);
  setPage(params.page === undefined ? 0 : Math.max(0, params.page - 1));
}

export function updateGetParameters(
  selection: Selection,
  pageNumber: number,
): void {
  const params: LeaderboardUrlParams = {
    client: selection.client ?? "web",
    type: selection.type,
    mode: selection.mode,
    mode2: selection.mode2,
    language: selection.language,
    page: pageNumber + 1,
  };

  if (selection.type === "weekly" && selection.previous) {
    params.lastWeek = true;
  }
  if (selection.type === "daily" && selection.previous) {
    params.yesterday = true;
  }
  const urlParams = serializeUrlSearchParams({
    schema: LeaderboardUrlParamsSchema,
    data: params,
  });
  const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
  void replaceUrl(newUrl);
}

function lsSelection(): [Accessor<Selection>, Setter<Selection>] {
  return useLocalStorage<Selection>({
    key: "leaderboardSelector",
    schema: SelectionSchema,
    fallback: {
      type: "allTime",
      mode: "time",
      mode2: "15",
      language: "english",
      previous: false,
    },
    migrate: (value) => {
      if (value === null || typeof value !== "object") {
        return {} as Selection;
      }
      const result = value as Selection;
      if ("lastWeek" in result) {
        delete result["lastWeek"];
        result.previous = true;
      } else if ("yesterday" in result) {
        delete result["yesterday"];
        result.previous = true;
      }

      if (result.type === "weekly") {
        delete result.mode;
        delete result.mode2;
        delete result.language;
      }
      return result;
    },
  });
}
