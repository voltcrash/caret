import { detectPlatform } from "@tanstack/solid-hotkeys";
import { JSXElement } from "solid-js";

import { Kbd } from "../../common/Kbd";

/** Settings sidebar footer; the loading layout passes default hotkeys. */
export function SettingsKeyTips(props: { palette: JSXElement }): JSXElement {
  return (
    // padded like the buttons: inset to line up with the item icons,
    // and space below to match the gap above the tip
    <div class="grid gap-2 px-2 pb-2 text-em-xs text-text">
      {/* keyboard shortcuts are hidden on touch, where they can't be used */}
      <div class="pointer-coarse:hidden">
        tip: you can also change all these settings quickly via the command
        palette (<span class="whitespace-nowrap">{props.palette}</span>)
      </div>
      <div class="pointer-coarse:hidden">
        tip: press{" "}
        <span class="whitespace-nowrap">
          <Kbd text={`${detectPlatform() === "mac" ? "cmd" : "ctrl"} + 1-9`} />
        </span>{" "}
        to jump to a section
      </div>
      <div class="hidden pointer-coarse:block">
        tip: tap the terminal icon in the nav to search every setting
      </div>
    </div>
  );
}
