import { For, type JSXElement } from "solid-js";

import { Skeleton } from "../../components/skeleton";
import { SkeletonText } from "../../components/skeleton-text";

/**
 * Mirrors UserProfile's cards (details, then time and words bests) while the
 * profile or its browser code loads, so the real profile fills them in place.
 */
export function ProfileSkeleton(): JSXElement {
  return (
    <Skeleton class="grid w-full grid-cols-1 gap-8">
      <div class="grid grid-cols-[1fr_minmax(0,2rem)] rounded bg-sub-alt pointer-coarse:grid-cols-[1fr_minmax(0,2.75rem)]">
        <div class="grid grid-cols-[minmax(0,1fr)] items-center gap-4 p-4 md:grid-cols-[17.5rem_auto_1fr]">
          <div class="grid w-full grid-cols-[5rem_1fr] items-center gap-4">
            <div class="aspect-square w-full rounded-full bg-bg"></div>
            <div class="grid gap-1 text-xs">
              <SkeletonText tone="bg" class="h-8 w-32 text-[2rem]" />
              <SkeletonText tone="bg" class="w-20 text-base" />
              <SkeletonText tone="bg" class="w-28" />
            </div>
            <div class="col-span-2 flex items-center gap-2">
              <SkeletonText tone="bg" class="w-4" />
              <div class="h-2 flex-1 rounded bg-bg"></div>
              <SkeletonText tone="bg" class="w-16 text-xs" />
            </div>
          </div>
          <div class="hidden h-full w-2 rounded bg-bg md:block"></div>
          <div class="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-2 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3 lg:text-[1.25rem]">
            <For each={[0, 1, 2]}>
              {() => (
                <div class="flex flex-col">
                  <SkeletonText tone="bg" class="w-24 text-em-sm" />
                  <SkeletonText tone="bg" class="h-8 w-16 text-em-2xl" />
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <For each={[0, 1]}>
          {() => (
            <div class="grid grid-cols-2 gap-4 rounded bg-sub-alt p-4 pr-12 sm:gap-8 md:grid-cols-4 pointer-coarse:pr-[3.75rem]">
              <For each={[0, 1, 2, 3]}>
                {() => (
                  <div class="grid justify-items-center">
                    <SkeletonText tone="bg" class="w-16 text-xs" />
                    <SkeletonText tone="bg" class="w-12 text-4xl" />
                    <SkeletonText tone="bg" class="w-10 text-xl" />
                  </div>
                )}
              </For>
            </div>
          )}
        </For>
      </div>
    </Skeleton>
  );
}
