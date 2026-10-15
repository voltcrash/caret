import { createSignal, onCleanup } from "solid-js";

import { createAppOwned } from "./application";

type ReadinessState =
  | { status: "idle" | "loading" | "ready" | "disposed" }
  | { status: "error"; error: unknown };

/** Explicit startup state, scoped to one owner; never a module startup promise. */
export type Readiness = {
  state: () => ReadinessState;
  wait: () => Promise<void>;
  start: (task: () => Promise<void>) => Promise<void>;
};

export function createReadiness(): Readiness {
  const [state, setState] = createSignal<ReadinessState>({ status: "idle" });
  const waiters = new Set<{
    resolve: () => void;
    reject: (error: unknown) => void;
  }>();
  let running: Promise<void> | undefined;
  const disposedError = new Error("Application disposed");
  onCleanup(() => {
    setState({ status: "disposed" });
    for (const waiter of waiters) waiter.reject(disposedError);
    waiters.clear();
  });
  return {
    state,
    async wait(): Promise<void> {
      const current = state();
      if (current.status === "ready") return Promise.resolve();
      if (current.status === "error") return Promise.reject(current.error);
      if (current.status === "disposed") return Promise.reject(disposedError);
      return new Promise((resolve, reject) => waiters.add({ resolve, reject }));
    },
    async start(task: () => Promise<void>): Promise<void> {
      if (state().status === "disposed") return Promise.reject(disposedError);
      if (running !== undefined) return running;
      setState({ status: "loading" });
      running = (async () => {
        try {
          await Promise.resolve();
          await task();
          if (state().status === "disposed") return;
          setState({ status: "ready" });
          for (const waiter of waiters) waiter.resolve();
          waiters.clear();
        } catch (error) {
          if (state().status === "disposed") return;
          setState({ status: "error", error });
          for (const waiter of waiters) waiter.reject(error);
          waiters.clear();
          throw error;
        }
      })();
      return running;
    },
  };
}

export const preferencesReadiness = createAppOwned(createReadiness);
export const authReadiness = createAppOwned(createReadiness);
export const configurationReadiness = createAppOwned(createReadiness);
