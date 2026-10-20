import { For, type JSXElement } from "solid-js";

import { Skeleton } from "../../components/skeleton";
import { SkeletonText } from "../../components/skeleton-text";
import { cn } from "../../ts/utils/cn";

/** Leaderboard page navigation and rows while a board's entries load. */
export function LeaderboardTableSkeleton(): JSXElement {
  return (
    <Skeleton>
      <div class="mb-2 grid grid-cols-1 items-center justify-between gap-2 text-sm sm:grid-cols-2 sm:text-base">
        <SkeletonText class="w-48" />
        <div class="flex gap-2 sm:justify-self-end">
          <For each={[0, 1, 2, 3]}>
            {() => (
              <div class="h-[2.25em] w-[2.25em] rounded bg-sub-alt pointer-coarse:min-h-11"></div>
            )}
          </For>
        </div>
      </div>
      {/* header, then rows striped like the table's odd rows */}
      <div class="grid text-em-base">
        <For each={Array.from({ length: 11 }, (_, row) => row)}>
          {(row) => {
            const striped = row % 2 === 1;
            const tone = striped ? "bg" : "sub";
            return (
              <div
                class={cn(
                  "flex items-center gap-4 rounded px-2 sm:px-4 xl:px-6",
                  row === 0 ? "py-2" : "py-3",
                  striped && "bg-sub-alt",
                )}
              >
                <SkeletonText class="w-6 shrink-0" tone={tone} />
                <SkeletonText class="w-40" tone={tone} />
                <div class="grow"></div>
                <For each={[0, 1, 2]}>
                  {() => <SkeletonText class="w-14 shrink-0" tone={tone} />}
                </For>
              </div>
            );
          }}
        </For>
      </div>
    </Skeleton>
  );
}
