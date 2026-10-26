import type { Client } from "@caret/schemas/shared";

import { useQuery } from "@tanstack/solid-query";
import { ClientOnly } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import { lazy, Show, Suspense, type JSXElement } from "solid-js";

import { onlyCachedOnServer } from "../../data/prefetch";
import { profileOptions } from "../../data/profile";
import { ProfileMissing } from "./missing";
import { ProfileSummary } from "./summary";

const UserProfile = lazy(
  createClientOnlyFn(async () => ({
    default: (await import("./profile.client")).profileLeaves.UserProfile,
  })),
);

export const preloadProfile = createClientOnlyFn(async (): Promise<void> => {
  await UserProfile.preload();
});

/** Shared with the route's pending view so the skeleton sits in place. */
export const profileFrame = "flex h-full flex-col justify-center gap-4 text-lg";

/**
 * `/profile/$uidOrName`: route-owned name and client selection. The server
 * renders a readable summary; the browser retains it until the full
 * profile's code arrives. Cached data remains visible during refresh.
 */
export function ProfilePage(props: {
  uidOrName: string;
  client: Client;
}): JSXElement {
  const profile = useQuery(() => ({
    ...profileOptions(props.uidOrName, props.client),
    enabled: onlyCachedOnServer(),
  }));
  return (
    <div class={profileFrame}>
      <Show when={profile.data}>
        {(data) => (
          <ClientOnly fallback={<ProfileSummary profile={data()} />}>
            <Suspense fallback={<ProfileSummary profile={data()} />}>
              <UserProfile profile={data()} client={props.client} />
            </Suspense>
          </ClientOnly>
        )}
      </Show>
      <Show when={profile.isError && profile.data === undefined}>
        <ProfileMissing name={props.uidOrName} />
      </Show>
    </div>
  );
}
