import { onCleanup, onMount } from "solid-js";

import { handleColorSchemeChange } from "../../controllers/theme-controller";

export function ThemeEvents(): null {
  onMount(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    query?.addEventListener?.("change", handleColorSchemeChange);
    onCleanup(() =>
      query?.removeEventListener?.("change", handleColorSchemeChange),
    );
  });
  return null;
}
