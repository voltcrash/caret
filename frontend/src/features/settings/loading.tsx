import { For, type JSXElement, Show } from "solid-js";

import type { SettingsSection } from "./tabs";

import { Skeleton } from "../../components/skeleton";
import { SkeletonText } from "../../components/skeleton-text";
import { Fa } from "../../ts/components/common/Fa";
import { H2 } from "../../ts/components/common/Headers";
import { Kbd } from "../../ts/components/common/Kbd";
import { Separator } from "../../ts/components/common/Separator";
import { SettingsKeyTips } from "../../ts/components/pages/settings/SettingsKeyTips";
import { cn } from "../../ts/utils/cn";
import { availableSettingsSections, settingsSections } from "./tabs";

/** Description lines and option count per placeholder setting row. */
const rows = [
  { lines: 3, options: 1 },
  { lines: 2, options: 2 },
  { lines: 2, options: 3 },
];

/**
 * Mirrors SidebarLayout and the settings sections while browser code and the
 * session get ready, so the real page replaces it without moving anything:
 * same labels, same centered sidebar, same heading for the open section.
 */
export function SettingsLoading(props: {
  section: SettingsSection;
  authenticated: boolean;
  /** Preference known once browser code runs; on by default. */
  keyTips?: boolean;
}): JSXElement {
  return (
    <section
      role="status"
      aria-label="Loading settings"
      aria-busy="true"
      class="content-grid flex flex-col gap-8 md:flex-row"
    >
      <p class="sr-only">loading your preferences…</p>
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
              <div class="w-full rounded bg-bg py-3 pr-10 pl-10 text-em-base text-sub">
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
      <div class="flex w-full flex-1 flex-col gap-8">
        <div class="grid gap-8">
          <H2
            text={settingsSections[props.section].text}
            fa={{ icon: settingsSections[props.section].icon }}
            class="pb-0 text-[1.5em]"
          />
          <Skeleton class="grid gap-8">
            <For each={[0, 1]}>
              {() => (
                <div class="grid gap-3">
                  <div class="px-4 text-em-sm md:px-5">
                    <SkeletonText class="w-28" />
                  </div>
                  <div class="divide-y divide-sub/20 rounded-double border border-sub/20">
                    <For each={rows}>
                      {(row) => (
                        <div class="grid gap-2 p-4 max-md:gap-3 md:p-5">
                          <div class="flex items-center gap-[0.5em]">
                            <div class="size-[1em] shrink-0 rounded bg-sub/20"></div>
                            <SkeletonText class="w-32" />
                          </div>
                          <div class="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr] md:gap-x-8 lg:grid-cols-[1.5fr_1fr] xl:grid-cols-[2fr_1fr]">
                            <div>
                              <For each={Array.from({ length: row.lines })}>
                                {(_, line) => (
                                  <SkeletonText
                                    class={
                                      line() === row.lines - 1
                                        ? "w-3/5"
                                        : undefined
                                    }
                                  />
                                )}
                              </For>
                            </div>
                            <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,4.5rem),1fr))] gap-2">
                              <For each={Array.from({ length: row.options })}>
                                {() => (
                                  <div class="h-[2.25em] rounded bg-sub-alt pointer-coarse:min-h-11"></div>
                                )}
                              </For>
                            </div>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </Skeleton>
        </div>
      </div>
    </section>
  );
}
