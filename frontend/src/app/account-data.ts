import { createSignal, untrack } from "solid-js";

import { createOwnedScope, type OwnedScope } from "./scope";

/** Browser collections and derived subscriptions for the mounted app. */
export type AccountDataOwner = {
  /** Reactive: readers re-run when the scope is replaced. */
  scope: () => OwnedScope;
  dispose: () => void;
};

export function createAccountDataOwner(): AccountDataOwner {
  const [scope] = createSignal(createOwnedScope());
  return {
    scope,
    dispose: () => untrack(scope).dispose(),
  };
}
