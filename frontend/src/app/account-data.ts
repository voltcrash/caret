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
  onChange: (listener: (previous: string | null) => void) => () => void;
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
  const listeners = new Set<(previous: string | null) => void>();
  return {
    actor,
    setActor: (next) => {
      if (disposed || next === untrack(actor)) return;
      const previous = untrack(actor);
      batch(() => {
        controller.abort(new DOMException("Account changed", "AbortError"));
        controller = new AbortController();
        generation++;
        void queryClient.cancelQueries({ queryKey: ["user"] });
        queryClient.removeQueries({ queryKey: ["user"] });
        untrack(scope).dispose();
        setActor(next);
        setScope(createOwnedScope());
        for (const listener of listeners) listener(previous);
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
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: () => {
      disposed = true;
      listeners.clear();
      controller.abort(new DOMException("Application disposed", "AbortError"));
      untrack(scope).dispose();
    },
  };
}
