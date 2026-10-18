import { useElementScrollRestoration } from "@tanstack/solid-router";
import { createContext, onCleanup, onMount, useContext } from "solid-js";

/** The common layout owns its scroller; lazy leaves announce content readiness. */
export const PageScrollHost =
  createContext<(position: { scrollX: number; scrollY: number }) => void>();

/** Reapply Router's cached position after a browser leaf has its final height. */
export function RestorePageScroll(): null {
  const position = useElementScrollRestoration({ id: "page-content" });
  const restore = useContext(PageScrollHost);
  onMount(() => {
    if (position === undefined) return;
    const frame = requestAnimationFrame(() => restore?.(position));
    onCleanup(() => cancelAnimationFrame(frame));
  });
  return null;
}
