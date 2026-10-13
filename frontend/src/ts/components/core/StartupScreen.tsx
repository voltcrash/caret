import { JSXElement } from "solid-js";

import { TypingLoader } from "../common/TypingLoader";

// Rendered into index.html at build time, before the application bundle runs.
export function StartupScreen(): JSXElement {
  return (
    <div
      id="startupScreen"
      class="fixed inset-0 z-9999 grid grid-cols-1 place-items-center bg-bg px-8"
      role="status"
      aria-live="polite"
    >
      <TypingLoader />
      <span class="sr-only">Loading Oxytype</span>
    </div>
  );
}
