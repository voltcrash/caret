import { For, type JSXElement, Show } from "solid-js";

import type { SettingsSection } from "./tabs";

import { Fa } from "../../ts/components/common/Fa";
import { Kbd } from "../../ts/components/common/Kbd";
import { Separator } from "../../ts/components/common/Separator";
import { SettingsKeyTips } from "../../ts/components/pages/settings/SettingsKeyTips";
import { cn } from "../../ts/utils/cn";
import { availableSettingsSections } from "./tabs";

/** Settings sidebar geometry while browser preferences load. */
export function SettingsSidebarSkeleton(props: {
  section: SettingsSection;
  authenticated: boolean;
  keyTips?: boolean;
}): JSXElement {
  return (
    <div class="w-full shrink-0 md:w-60 md:self-start">
      {/* SidebarLayout centers its fixed nav below the header, or pins it
            under the header when taller; a symmetric safe-centered frame
            places it identically without measuring */}
      <div class="md:pointer-events-none md:fixed md:top-(--content-top) md:bottom-(--content-top) md:flex md:w-60 md:items-center-safe">
        <div
          aria-hidden="true"
          class="grid w-full grid-cols-2 gap-2 rounded-double bg-sub-alt p-4 md:flex md:max-h-[calc(100vh-var(--content-top)-1rem)] md:flex-col md:items-start md:gap-4 md:overflow-hidden"
        >
          <div class="relative col-span-full w-full">
            <Fa
              icon="fa-search"
              class="absolute top-1/2 left-4 -translate-y-1/2 text-sub"
            />
            {/* global input styles arrive with the browser bundle, so the
                  search box's line height and touch height are explicit */}
            <div class="w-full rounded bg-bg py-3 pr-10 pl-10 text-em-base leading-[1.25em] text-sub pointer-coarse:min-h-11">
              search
            </div>
          </div>
          <For
            each={Object.entries(
              availableSettingsSections(props.authenticated),
            )}
          >
            {([key, item]) => (
              <div
                class={cn(
                  "inline-flex h-min w-full min-w-0 items-center justify-start gap-[0.5em] rounded p-[0.5em] text-left leading-[1.25] text-text pointer-coarse:min-h-11",
                  key === props.section && "bg-bg font-semibold text-main",
                )}
              >
                <Fa icon={item.icon} class="shrink-0" />
                <span class="min-w-0 wrap-anywhere">{item.text}</span>
              </div>
            )}
          </For>
          <Show when={props.keyTips ?? true}>
            <div class="col-span-full grid w-full gap-6">
              <Separator class="mx-2 w-auto bg-bg" />
              <div class="grid gap-2">
                <SettingsKeyTips
                  // default hotkeys; custom ones rarely change the wrap
                  palette={
                    <>
                      <Kbd hotkey="Mod+K" />
                      &nbsp;or&nbsp;
                      <Kbd hotkey="Mod+Shift+P" />
                    </>
                  }
                />
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
