import { JSXElement, Show } from "solid-js";

import { getSnapshot } from "../../../ts/states/snapshot";
import { UserProfile } from "../../profile/components/UserProfile";

export function MyProfile(): JSXElement {
  return (
    <Show when={getSnapshot()} fallback="no user found">
      {(profile) => (
        <UserProfile profile={profile()} client="web" isAccountPage />
      )}
    </Show>
  );
}
