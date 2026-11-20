import { createEffect } from "solid-js";

import { createAppOwned } from "../../../app/application";
import { getConfig } from "../../../ts/config/store";
import { getCustomTextIndicator } from "../../../ts/states/core";
import { setIsLongTest } from "../../../ts/states/test";
import { canQuickRestart } from "../../../ts/utils/quick-restart";
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
