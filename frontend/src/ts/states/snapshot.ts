import { QueryObserver } from "@tanstack/solid-query";
import { createSignal, onCleanup } from "solid-js";
import { createAccountOwned } from "../../app/account-scope";
import { createAccountSignal } from "../../app/state";
import {
  Snapshot,
  SnapshotResult,
  SavedResult,
} from "../constants/default-snapshot";
import { getQueryClient } from "../queries";
import { getAccountQueryOptions } from "../queries/account";

import { Mode } from "@oxytype/schemas/shared";

/** A reactive view of the actor's query-owned account; never a second copy. */
const accountView = createAccountOwned(() => {
  const observer = new QueryObserver(getQueryClient(), {
    ...getAccountQueryOptions(),
    enabled: false,
  });
  const [data, setData] = createSignal(observer.getCurrentResult().data, {
    equals: false,
  });
  onCleanup(observer.subscribe((result) => setData(() => result.data)));
  return data;
});

/** Calendars are read through `db.getTestActivityCalendar`. */
export type ReactiveSnapshot = Omit<
  Snapshot,
  "testActivity" | "testActivityByYear"
>;

export function getSnapshot(): ReactiveSnapshot | undefined {
  return accountView()();
}

export const [getLastResult, setLastResult] = createAccountSignal<
  SnapshotResult<Mode> | SavedResult | undefined
>(undefined);
