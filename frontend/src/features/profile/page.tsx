import type { Client } from "@oxytype/schemas/shared";

import { useQuery } from "@tanstack/solid-query";
import { ClientOnly } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import { lazy, Show, Suspense, type JSXElement } from "solid-js";

import { onlyCachedOnServer } from "../../data/prefetch";
import { profileOptions } from "../../data/profile";
import { ProfileMissing } from "./missing";
import { ProfileSkeleton } from "./skeleton";
import { ProfileSummary } from "./summary";

const UserProfile = lazy(
  createClientOnlyFn(async () => ({
    default: (await import("./profile.client")).profileLeaves.UserProfile,
  })),
);

/** Shared with the route's pending view so the skeleton sits in place. */
export const profileFrame = "flex h-full flex-col justify-center gap-4 text-lg";

/**
 * `/profile/$uidOrName`: route-owned name and client selection. The server
 * renders a readable summary; the browser shows the skeleton until the full
 * profile's code arrives.
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
            <Suspense fallback={<ProfileSkeleton />}>
              <UserProfile profile={data()} client={props.client} />
            </Suspense>
          </ClientOnly>
        )}
      </Show>
      <Show when={profile.isError}>
        <ProfileMissing name={props.uidOrName} />
      </Show>
    </div>
  );
}
