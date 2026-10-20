import type { Client } from "@oxytype/schemas/shared";

import { createResource, type JSXElement, Match, Switch } from "solid-js";

import { AccountContent } from "../../ts/components/pages/account/AccountContent";
import { getSnapshot } from "../../ts/db";
import { getUserId } from "../../ts/states/core";
import { useSessionSettled } from "../auth/settled.client";
import * as TodayTracker from "../typing/runtime/today-tracker";
import { AccountSkeleton } from "./skeleton";

/**
 * Waits for the actor's snapshot and result history behind the account
 * skeleton, then shows statistics. Charts and history never render on the server.
 */
export function AccountView(props: { client: Client }): JSXElement {
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
        <AccountSkeleton />
      </Match>
      <Match when={true}>
        <AccountContent client={props.client} />
      </Match>
    </Switch>
  );
}
