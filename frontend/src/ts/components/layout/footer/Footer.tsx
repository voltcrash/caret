import { JSXElement } from "solid-js";

import { getIsScreenshotting } from "../../../states/core";
import { getFocus } from "../../../states/test";
import { cn } from "../../../utils/cn";
import { Keytips } from "./Keytips";
import { ThemeIndicator } from "./ThemeIndicator";
import { VersionButton } from "./VersionButton";

export function Footer(): JSXElement {
  return (
    <footer
      class={cn(
        "relative text-sm text-sub sm:text-xs",
        // footer buttons are tapped, not read
        "pointer-coarse:select-none",
        getFocus() && "focus",
        {
          "opacity-0": getIsScreenshotting(),
        },
      )}
    >
      <Keytips />

      <div
        class={cn(
          // phones: one row, theme left and version right, 44px tall
          "-m-2 flex flex-row items-end justify-between text-right transition-opacity [&>*]:min-h-11 sm:flex-col sm:justify-end sm:[&>*]:min-h-0 lg:flex-row lg:justify-end",
          getFocus() && "opacity-0",
        )}
      >
        <ThemeIndicator />
        <VersionButton />
      </div>
    </footer>
  );
}
