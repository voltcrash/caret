import { JSXElement, Show } from "solid-js";

import { UserProfile } from "../../../../features/profile/components/UserProfile";
import { getSnapshot } from "../../../states/snapshot";

export function MyProfile(): JSXElement {
  return (
    <Show when={getSnapshot()} fallback="no user found">
      {(profile) => (
        <UserProfile profile={profile()} client="web" isAccountPage />
      )}
    </Show>
  );
}
