import { appSignal } from "../../app/state";
import { Accessor, Setter } from "solid-js";
import {
  defaultSelection,
  type LeaderboardType,
  LeaderboardUrlParamsSchema,
  type Selection,
  SelectionSchema,
} from "../../features/leaderboards/selection";
import { useLocalStorage } from "../hooks/useLocalStorage";

export type { LeaderboardType, Selection };
export { LeaderboardUrlParamsSchema };

/** Last browsed board, remembered for bare `/leaderboards` visits. */
const [getSelectionLs, setSelection] = appSignal(lsSelection);

export const getSelection = (): Selection => {
  return getSelectionLs();
};

export { setSelection };

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
