import { createAppMemo } from "#app/application.ts";
import { createAppSignal } from "#app/state.ts";
import { getConfig } from "#shared/config/store.ts";
import { testFocusState } from "#shared/states/test.ts";

export const showOutOfFocusWarning = createAppMemo(
  () => getConfig.showOutOfFocusWarning && testFocusState() !== "focused",
);

// max-height of the warning, kept in sync with the words wrapper by test-ui.
export const [outOfFocusMaxHeight, setOutOfFocusMaxHeight] = createAppSignal<
  number | undefined
>(undefined);
