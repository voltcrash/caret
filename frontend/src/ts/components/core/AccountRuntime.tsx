import { createEffectOn } from "../../hooks/effects";
import { getQueryClient } from "../../queries";
import { isAuthenticated } from "../../states/core";

/** Owns account-change reactions for this application mount. */
export function AccountRuntime(): null {
  createEffectOn(
    isAuthenticated,
    (hasUser) => {
      // Some user-bound collections initialize while signed out (tags, presets);
      // reset on every change, not only logout, so login never leaves them empty.
      void getQueryClient().resetQueries({ queryKey: ["user"] });
      if (hasUser) {
        void import("../../collections/results").then((m) =>
          m.refetchResults(),
        );
      }
    },
    { defer: true },
  );
  return null;
}
