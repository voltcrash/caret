import { useQuery } from "@tanstack/solid-query";
import { JSXElement, Show } from "solid-js";

import type { PageName } from "../../../pages/page";

import { useClientSelection } from "../../../hooks/useClientSelection";
import { getUserProfile } from "../../../queries/profile";
import { getActivePage, getSelectedProfileName } from "../../../states/core";
import AsyncContent from "../../common/AsyncContent";
import { ClientToggle } from "../../common/ClientToggle";
import { Fa } from "../../common/Fa";
import { Page } from "../../common/Page";
import { UserProfile } from "./UserProfile";

const pageName: PageName = "profile";
export function ProfilePage(): JSXElement {
  const isOpen = () => getActivePage() === pageName;
  const [client, setClient] = useClientSelection();

  const profileQuery = useQuery(() => ({
    ...getUserProfile(getSelectedProfileName() as string, client()),
    enabled: isOpen() && getSelectedProfileName() !== undefined,
  }));

  return (
    <Page id="profile">
      <div class="flex h-full flex-col justify-center gap-4 text-lg">
        <ClientToggle value={client()} onChange={setClient} />
        <AsyncContent queries={{ profileQuery }} ignoreError={true}>
          {({ profileQueryData }) => (
            <UserProfile profile={profileQueryData()} client={client()} />
          )}
        </AsyncContent>
        <Show when={profileQuery.isError}>
          <div class="flex items-baseline gap-2 text-error">
            <Fa icon="fa-times" />
            <span>User {getSelectedProfileName()} not found</span>
          </div>
        </Show>
      </div>
    </Page>
  );
}
