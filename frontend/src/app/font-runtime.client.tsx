import { MetaProvider, Style } from "@solidjs/meta";
import { createEffect, onMount, type JSXElement } from "solid-js";

import { configEvent } from "../ts/events/config";
import { getFontFace, getFontFamily } from "../ts/states/app";
import { applyFontFamily } from "./fonts.client";

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
  configEvent.useListener(({ key }) => {
    if (key === "fontFamily" || key === "language") apply();
  });
  onMount(apply);
  return (
    <MetaProvider>
      <Style class="customFont">{getFontFace()}</Style>
    </MetaProvider>
  );
}
