import { For, type JSXElement } from "solid-js";

import { Skeleton } from "../../components/skeleton";
import { SkeletonText } from "../../components/skeleton-text";

/** Board and mode pickers while the server configuration loads. */
export function LeaderboardSidebarSkeleton(): JSXElement {
  return (
    <Skeleton>
      <For each={[3, 2]}>
        {(items) => (
          <div class="mb-2 flex gap-2 overflow-hidden rounded-xl bg-sub-alt p-2 lg:mb-4 lg:grid lg:gap-4 lg:p-4">
            <For each={Array.from({ length: items })}>
              {() => (
                <div class="flex h-[2.25em] shrink-0 items-center gap-[0.5em] px-[0.75em] max-lg:min-h-11">
                  <div class="size-[1em] shrink-0 rounded bg-bg"></div>
                  <SkeletonText class="w-24" tone="bg" />
                </div>
              )}
            </For>
          </div>
        )}
      </For>
    </Skeleton>
  );
}
