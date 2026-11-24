import { For, JSXElement, Show } from "solid-js";

import { Separator } from "#shared/components/common/Separator.tsx";
import { getConfig } from "#shared/config/store.ts";
import { ThemesList, ThemeWithName } from "#shared/constants/themes.ts";
import { clearPreview } from "#shared/controllers/theme-controller.ts";
import { hexToHSL } from "#shared/utils/colors.ts";

import { ThemeButton } from "./ThemeButton";

// darkest background first
const sortedThemes: ThemeWithName[] = [...ThemesList].sort((a, b) => {
  const b1 = hexToHSL(a.bg);
  const b2 = hexToHSL(b.bg);
  return b1.lgt - b2.lgt;
});

export function PresetThemes(): JSXElement {
  return (
    <div class="grid gap-4" onMouseLeave={() => void clearPreview()}>
      <Show when={getConfig.favThemes.length > 0}>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <For
            each={sortedThemes.filter((t) =>
              getConfig.favThemes.includes(t.name),
            )}
          >
            {(theme) => <ThemeButton theme={theme} />}
          </For>
        </div>
      </Show>
      <Show when={getConfig.favThemes.length > 0}>
        <Separator />
      </Show>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <For
          each={sortedThemes.filter(
            (t) => !getConfig.favThemes.includes(t.name),
          )}
        >
          {(theme) => <ThemeButton theme={theme} />}
        </For>
      </div>
    </div>
  );
}
