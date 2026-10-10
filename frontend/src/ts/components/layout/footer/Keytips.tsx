import { JSXElement, Show } from "solid-js";

import { getConfig } from "../../../config/store";
import { getFocus } from "../../../states/test";
import { cn } from "../../../utils/cn";
import { CommandPaletteHotkey } from "../../hotkeys/CommandPaletteHotkey";
import { QuickRestartHotkey } from "../../hotkeys/QuickRestartHotkey";

export function Keytips(): JSXElement {
  return (
    <Show when={getConfig.showKeyTips}>
      <div
        class={cn(
          // keyboard shortcuts are useless on touch devices
          "mb-8 hidden flex-col items-center gap-2 transition-opacity pointer-fine:sm:flex",
          getFocus() && "opacity-0",
        )}
      >
        <div class="flex items-center gap-2">
          <QuickRestartHotkey />
          <span>- restart test</span>
        </div>

        <div class="flex items-center gap-2">
          <CommandPaletteHotkey />
          <span>- command palette</span>
        </div>
      </div>
    </Show>
  );
}
