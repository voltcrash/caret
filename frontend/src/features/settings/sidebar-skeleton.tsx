import { For, type JSXElement, Show } from "solid-js";

import type { SettingsSection } from "./tabs";

import { SkeletonText } from "../../components/skeleton-text";
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
          {/* Explicit input geometry also applies before browser styles load. */}
          <div
            data-settings-search-skeleton
            class="col-span-full flex w-full items-center gap-[0.5em] rounded bg-bg px-4 py-3 text-em-base pointer-coarse:min-h-11"
          >
            <div class="size-[1em] shrink-0 rounded bg-sub/20"></div>
            <SkeletonText class="h-[1.25em] w-16" />
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
