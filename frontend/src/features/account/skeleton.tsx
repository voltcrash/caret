import { For, type JSXElement } from "solid-js";

import { Skeleton } from "../../components/skeleton";
import { SkeletonText } from "../../components/skeleton-text";
import { ProfileSkeleton } from "../profile/skeleton";

const button = "h-[2.25em] w-full rounded bg-sub-alt pointer-coarse:min-h-11";

/**
 * Mirrors AccountContent (profile, filters, history chart) while the session
 * is checked and the actor's results download.
 */
export function AccountSkeleton(): JSXElement {
  return (
    <div
      role="status"
      aria-label="Loading account"
      aria-busy="true"
      class="flex flex-col gap-8"
    >
      <ProfileSkeleton />
      <Skeleton class="flex flex-col">
        <div class="pb-[0.5em]">
          <SkeletonText class="w-20" />
        </div>
        <div class="mb-4 grid grid-cols-2 gap-4 lg:flex">
          <For each={[0, 1, 2, 3]}>{() => <div class={button}></div>}</For>
        </div>
        <div class="grid grid-cols-2 gap-4 lg:flex">
          <For each={[0, 1, 2, 3, 4, 5]}>
            {() => <div class={button}></div>}
          </For>
        </div>
      </Skeleton>
      <Skeleton class="grid gap-4">
        <SkeletonText class="mx-auto mt-4 w-2/3" />
        <div class="h-[280px] rounded bg-sub-alt sm:h-[400px]"></div>
      </Skeleton>
      <p class="sr-only">loading your results…</p>
    </div>
  );
}
