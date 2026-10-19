import { For, type JSXElement } from "solid-js";

import { Fa } from "../../ts/components/common/Fa";

/** Match the settings layout while its browser code and session get ready. */
export function SettingsLoading(): JSXElement {
  return (
    <section
      role="status"
      aria-label="Loading settings"
      aria-busy="true"
      class="content-grid flex flex-col gap-8 md:flex-row"
    >
      <div
        aria-hidden="true"
        class="grid w-full shrink-0 grid-cols-2 gap-2 rounded-double bg-sub-alt p-4 motion-safe:animate-pulse md:w-60 md:self-start md:grid-cols-1 md:gap-4"
      >
        <div class="col-span-full h-11 rounded bg-bg"></div>
        <For each={[0, 1, 2, 3, 4, 5, 6, 7]}>
          {() => (
            <div class="flex h-9 items-center gap-3 px-2">
              <div class="size-4 shrink-0 rounded bg-bg"></div>
              <div class="h-3 w-24 rounded bg-bg"></div>
            </div>
          )}
        </For>
        <div class="col-span-full mt-2 grid gap-3 border-t border-bg px-2 pt-6 pb-2">
          <div class="h-2 w-full rounded bg-bg"></div>
          <div class="h-2 w-3/4 rounded bg-bg"></div>
        </div>
      </div>
      <div class="grid min-w-0 flex-1 content-start gap-8">
        <div class="grid gap-3">
          <h2 class="flex items-center gap-3 text-[1.5em] text-text">
            <Fa icon="fa-sliders-h" class="text-main" />
            settings
          </h2>
          <p class="text-em-sm text-sub">loading your preferences…</p>
        </div>
        <div aria-hidden="true" class="grid gap-8 motion-safe:animate-pulse">
          <For each={[0, 1]}>
            {() => (
              <div class="grid gap-3">
                <div class="mx-4 h-3 w-28 rounded bg-sub/20 md:mx-5"></div>
                <div class="divide-y divide-sub/20 rounded-double border border-sub/20">
                  <For each={[0, 1, 2]}>
                    {() => (
                      <div class="grid gap-5 p-4 md:p-5">
                        <div class="h-4 w-36 rounded bg-sub/20"></div>
                        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr]">
                          <div class="grid content-start gap-3">
                            <div class="h-3 w-full rounded bg-sub/20"></div>
                            <div class="h-3 w-3/4 rounded bg-sub/20"></div>
                          </div>
                          <div class="grid grid-cols-3 gap-2">
                            <div class="h-9 rounded bg-sub-alt"></div>
                            <div class="h-9 rounded bg-sub-alt"></div>
                            <div class="h-9 rounded bg-sub-alt"></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </section>
  );
}
