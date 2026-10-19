import { JSXElement } from "solid-js";

import { getIsScreenshotting } from "../../../states/core";
import { getFocus } from "../../../states/test";
import { cn } from "../../../utils/cn";
import { Keytips } from "./Keytips";

export function Footer(): JSXElement {
  return (
    <footer
      class={cn(
        "relative text-sm text-text sm:text-xs",
        // footer buttons are tapped, not read
        "pointer-coarse:select-none",
        getFocus() && "focus",
        {
          "opacity-0": getIsScreenshotting(),
        },
      )}
    >
      <Keytips />
    </footer>
  );
}
