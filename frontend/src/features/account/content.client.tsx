import type { Client } from "@oxytype/schemas/shared";

import { createResource, type JSXElement, Match, Switch } from "solid-js";

import { LoadingCircle } from "../../ts/components/common/LoadingCircle";
import { AccountContent } from "../../ts/components/pages/account/AccountContent";
import { getSnapshot } from "../../ts/db";
import { getUserId } from "../../ts/states/core";
import * as TodayTracker from "../../ts/test/today-tracker";
import { useSessionSettled } from "../auth/settled.client";

/**
 * Waits for the actor's snapshot and result history (the old page's loading
 * screen), then shows statistics. Charts and history never render on the server.
 */
export function AccountView(props: {
  client: Client;
  onClient: (client: Client) => void;
}): JSXElement {
  const settled = useSessionSettled();
  // Keyed by actor: history loads under the signed-in account's scope.
  const [results] = createResource(
    () => (settled() ? (getUserId() ?? undefined) : undefined),
    async () => {
      const { waitForResultsReady } =
        await import("../../ts/collections/results");
      await waitForResultsReady();
      await TodayTracker.addAllFromToday();
      return true;
    },
  );
  return (
    <Switch>
      <Match when={results.error !== undefined}>
        <div class="grid h-150 place-items-center text-error">
          Failed to load your results. Please refresh the page.
        </div>
      </Match>
      <Match when={results() !== true || getSnapshot() === undefined}>
        <div
          class="grid h-150 place-items-center text-4xl"
          aria-label="Downloading results"
        >
          <LoadingCircle />
        </div>
      </Match>
      <Match when={true}>
        <AccountContent client={props.client} onClient={props.onClient} />
      </Match>
    </Switch>
  );
}
