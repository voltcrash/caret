import { useElementScrollRestoration } from "@tanstack/solid-router";
import { createContext, onCleanup, onMount, useContext } from "solid-js";

/** The common layout owns its scroller; lazy leaves announce content readiness. */
export const PageScrollHost =
  createContext<(position: { scrollX: number; scrollY: number }) => void>();

/** Reapply Router's cached position after a browser leaf has its final height. */
export function RestorePageScroll(props: { fallback?: () => void }): null {
  const position = useElementScrollRestoration({ id: "page-content" });
  const restore = useContext(PageScrollHost);
  onMount(() => {
    const frame = requestAnimationFrame(() => {
      if (position === undefined) props.fallback?.();
      else restore?.(position);
    });
    onCleanup(() => cancelAnimationFrame(frame));
  });
  return null;
}
