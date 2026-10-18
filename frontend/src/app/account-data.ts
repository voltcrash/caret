import type { QueryClient } from "@tanstack/solid-query";
import { batch, createSignal, untrack } from "solid-js";

import { createOwnedScope, type OwnedScope } from "./scope";

/** Browser collections and derived subscriptions for the mounted app. */
export type AccountDataOwner = {
  actor: () => string | null;
  setActor: (actor: string | null) => void;
  capture: () => AccountLease;
  /** Reactive: readers re-run when the scope is replaced. */
  scope: () => OwnedScope;
  dispose: () => void;
};

export type AccountLease = {
  actor: string | null;
  generation: number;
  signal: AbortSignal;
  isCurrent: () => boolean;
  assertCurrent: () => void;
};

export function createAccountDataOwner(
  queryClient: QueryClient,
): AccountDataOwner {
  const [actor, setActor] = createSignal<string | null>(null);
  const [scope, setScope] = createSignal(createOwnedScope());
  let generation = 0;
  let controller = new AbortController();
  let disposed = false;
  return {
    actor,
    setActor: (next) => {
      if (disposed || next === untrack(actor)) return;
      batch(() => {
        controller.abort(new DOMException("Account changed", "AbortError"));
        controller = new AbortController();
        generation++;
        void queryClient.cancelQueries({ queryKey: ["user"] });
        queryClient.removeQueries({ queryKey: ["user"] });
        untrack(scope).dispose();
        setActor(next);
        setScope(createOwnedScope());
      });
    },
    capture: () => {
      const signal = controller.signal;
      const isCurrent = (): boolean => !disposed && !signal.aborted;
      return {
        actor: untrack(actor),
        generation,
        signal,
        isCurrent,
        assertCurrent: () => {
          if (!isCurrent()) {
            throw new DOMException("Account changed", "AbortError");
          }
        },
      };
    },
    scope,
    dispose: () => {
      disposed = true;
      controller.abort(new DOMException("Application disposed", "AbortError"));
      untrack(scope).dispose();
    },
  };
}
