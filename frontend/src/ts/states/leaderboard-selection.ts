import { createAppSignal, appSignal } from "../../app/state";
import { Accessor, Setter } from "solid-js";
import { serialize as serializeUrlSearchParams } from "zod-urlsearchparams";
import {
  applyUrlParams,
  defaultSelection,
  type LeaderboardType,
  type LeaderboardUrlParams,
  LeaderboardUrlParamsSchema,
  pageSize,
  type Selection,
  SelectionSchema,
  urlParams,
} from "../../features/leaderboards/selection";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { replaceUrl } from "../navigation/navigation";

export { pageSize };
export type { LeaderboardType, LeaderboardUrlParams, Selection };
export { LeaderboardUrlParamsSchema };

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
  const view = applyUrlParams(getSelection(), params ?? {}, getPage());
  if (params?.type === undefined && params?.client === undefined) return;
  setSelection(view.selection);
  if (params.type !== undefined) setGoToUserPage(view.goToUserPage);
  setPage(view.page);
}

export function updateGetParameters(
  selection: Selection,
  pageNumber: number,
): void {
  const params = urlParams(selection, pageNumber);
  const search = serializeUrlSearchParams({
    schema: LeaderboardUrlParamsSchema,
    data: params,
  });
  const newUrl = `${window.location.pathname}?${search.toString()}`;
  void replaceUrl(newUrl);
}

function lsSelection(): [Accessor<Selection>, Setter<Selection>] {
  return useLocalStorage<Selection>({
    key: "leaderboardSelector",
    schema: SelectionSchema,
    fallback: defaultSelection,
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
