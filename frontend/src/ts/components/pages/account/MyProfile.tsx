import { Client } from "@oxytype/schemas/shared";
import { useQuery } from "@tanstack/solid-query";
import { JSXElement, Show } from "solid-js";

import { getTerminalAccountQueryOptions } from "../../../queries/account";
import { getSnapshot } from "../../../states/snapshot";
import AsyncContent from "../../common/AsyncContent";
import { UserProfile } from "../profile/UserProfile";

export function MyProfile(props: { client: Client }): JSXElement {
  const profile = getSnapshot;
  const terminalProfile = useQuery(() => ({
    ...getTerminalAccountQueryOptions(),
    enabled: profile() !== undefined && props.client === "tui",
  }));
  return (
    <Show
      when={props.client === "web"}
      fallback={
        <AsyncContent queries={{ terminalProfile }}>
          {({ terminalProfileData }) => (
            <UserProfile
              profile={terminalProfileData()}
              client="tui"
              isAccountPage
            />
          )}
        </AsyncContent>
      }
    >
      <Show when={profile()} fallback="no user found">
        {(p) => <UserProfile profile={p()} client="web" isAccountPage />}
      </Show>
    </Show>
  );
}
