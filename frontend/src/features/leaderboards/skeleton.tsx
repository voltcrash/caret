import type { JSXElement } from "solid-js";

import { Skeleton } from "../../components/skeleton";
import { SkeletonText } from "../../components/skeleton-text";
import { LeaderboardSidebarSkeleton } from "./sidebar-skeleton";
import { LeaderboardTableSkeleton } from "./table-skeleton";

/** LeaderboardContent's layout while its browser code loads. */
export function LeaderboardSkeleton(): JSXElement {
  return (
    <div
      role="status"
      aria-label="Loading leaderboard"
      aria-busy="true"
      class="content-grid flex flex-col gap-6 lg:flex-row lg:gap-8"
    >
      <div class="w-full shrink-0 lg:w-60 2xl:w-75">
        <LeaderboardSidebarSkeleton />
      </div>
      <div class="flex w-full flex-1 flex-col gap-6 lg:gap-8">
        <Skeleton class="text-xl sm:text-2xl md:text-3xl xl:text-4xl">
          <SkeletonText class="w-2/3 max-w-xl" />
        </Skeleton>
        <div class="h-1 w-full rounded bg-sub-alt"></div>
        <LeaderboardTableSkeleton />
      </div>
    </div>
  );
}
