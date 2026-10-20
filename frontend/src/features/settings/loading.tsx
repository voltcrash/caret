import { For, type JSXElement } from "solid-js";

import type { SettingsSection } from "./tabs";

import { Skeleton } from "../../components/skeleton";
import { SkeletonText } from "../../components/skeleton-text";
import { H2 } from "../../ts/components/common/Headers";
import { SettingsSidebarSkeleton } from "./sidebar-skeleton";
import { settingsSections } from "./tabs";

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
      <SettingsSidebarSkeleton
        section={props.section}
        authenticated={props.authenticated}
        keyTips={props.keyTips}
      />
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
