import type { Client } from "@oxytype/schemas/shared";

import { useQuery } from "@tanstack/solid-query";
import { ClientOnly } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import { lazy, Show, Suspense, type JSXElement } from "solid-js";

import { onlyCachedOnServer } from "../../data/prefetch";
import { profileOptions } from "../../data/profile";
import { ClientToggle } from "../../ts/components/common/ClientToggle";
import { ProfileMissing } from "./missing";
import { ProfileSummary } from "./summary";

const UserProfile = lazy(
  createClientOnlyFn(async () => ({
    default: (await import("./profile.client")).profileLeaves.UserProfile,
  })),
);

/** `/profile/$uidOrName`: route-owned name and client selection. */
export function ProfilePage(props: {
  uidOrName: string;
  client: Client;
  onClient: (client: Client) => void;
}): JSXElement {
  const profile = useQuery(() => ({
    ...profileOptions(props.uidOrName, props.client),
    enabled: onlyCachedOnServer(),
  }));
  return (
    <div class="flex h-full flex-col justify-center gap-4 text-lg">
      <ClientToggle value={props.client} onChange={props.onClient} />
      <Show when={profile.data}>
        {(data) => (
          <ClientOnly fallback={<ProfileSummary profile={data()} />}>
            <Suspense fallback={<ProfileSummary profile={data()} />}>
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
