import { JSXElement } from "solid-js";

import { useClientSelection } from "../../../hooks/useClientSelection";
import { Page } from "../../common/Page";
import { AccountContent } from "./AccountContent";

/** Rollback page lifecycle; Start renders AccountContent from its route. */
export function AccountPage(): JSXElement {
  const [client, setClient] = useClientSelection();
  return (
    <Page id="account" needsAuthentication>
      <AccountContent client={client()} onClient={setClient} />
    </Page>
  );
}
