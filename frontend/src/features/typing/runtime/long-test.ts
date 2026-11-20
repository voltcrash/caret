import { createEffect } from "solid-js";

import { createAppOwned } from "#app/application.ts";
import { getConfig } from "#shared/config/store.ts";
import { getCustomTextIndicator } from "#shared/states/core.ts";
import { setIsLongTest } from "#shared/states/test.ts";
import { canQuickRestart } from "./quick-restart";
import * as CustomText from "./content/custom-text";

/** Tracks whether the configured test is too long to quick restart. */
export const initializeTypingState = createAppOwned(() =>
  createEffect(() => {
    setIsLongTest(
      canQuickRestart(
        getConfig.mode,
        getConfig.words,
        getConfig.time,
        CustomText.getData(),
        getCustomTextIndicator()?.isLong ?? false,
      ) === false,
    );
  }),
);
