import type { JSXElement, ParentProps } from "solid-js";

import { isServer } from "solid-js/web";

import { cn } from "../ts/utils/cn";

/** Matches Tailwind's `animate-pulse` duration. */
const pulseMs = 2000;

/**
 * Pulsing placeholder group. Every mount joins the document's pulse phase, so
 * one skeleton replacing another (route pending → page fallback) never
 * restarts the animation.
 */
export function Skeleton(props: ParentProps<{ class?: string }>): JSXElement {
  return (
    <div
      aria-hidden="true"
      class={cn("motion-safe:animate-pulse", props.class)}
      style={{
        "animation-delay": isServer
          ? undefined
          : `-${Math.round(performance.now() % pulseMs)}ms`,
      }}
    >
      {props.children}
    </div>
  );
}
