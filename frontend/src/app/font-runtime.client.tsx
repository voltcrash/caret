import { MetaProvider, Style } from "@solidjs/meta";
import { createEffect, type JSXElement } from "solid-js";

import { configEvent } from "../ts/events/config";
import { getFontFace, getFontFamily } from "../ts/states/app";
import { applyFontFamily } from "./fonts.client";
import { preferencesReadiness } from "./readiness";

/** Font work runs after mount; IndexedDB/language reads never gate the shell. */
export function FontRuntime(): JSXElement {
  createEffect(() => {
    const font = getFontFamily();
    if (font !== undefined) {
      document.documentElement.style.setProperty("--font", font);
    }
  });
  const apply = (): void => {
    void applyFontFamily().catch((error: unknown) =>
      console.error("Failed to apply font", error),
    );
  };
  const ready = () => preferencesReadiness().state().status === "ready";
  let fullConfigChange = false;
  configEvent.useListener(({ key }) => {
    if (key === "fullConfigChange") {
      fullConfigChange = true;
    } else if (key === "fullConfigChangeFinished") {
      fullConfigChange = false;
      if (ready()) apply();
    } else if (
      !fullConfigChange &&
      ready() &&
      (key === "fontFamily" || key === "language")
    ) {
      apply();
    }
  });
  createEffect(() => {
    if (ready()) apply();
  });
  return (
    <MetaProvider>
      <Style class="customFont">{getFontFace()}</Style>
    </MetaProvider>
  );
}
