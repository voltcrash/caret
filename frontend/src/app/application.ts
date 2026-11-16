import type { QueryClient } from "@tanstack/solid-query";
import {
  createMemo,
  createRoot,
  createSignal,
  getOwner,
  onCleanup,
  type Owner,
  runWithOwner,
  untrack,
} from "solid-js";
import { isServer } from "solid-js/web";

import type { AccountDataOwner } from "./account-data";
import { createOwnedScope, type OwnedScope } from "./scope";

/** Owners of one mounted browser application; SSR renders never register one. */
export type Application = {
  /** Reactive root for app-owned computations; disposed on unmount. */
  owner: Owner;
  /** App-lifetime lazily created state; survives route remounts. */
  state: OwnedScope;
  queryClient: QueryClient;
  accountData: AccountDataOwner;
};

export type ApplicationRoot = Pick<Application, "owner" | "state"> & {
  dispose: () => void;
};

export function createApplicationRoot(): ApplicationRoot {
  return createRoot((disposeOwner) => {
    const state = createOwnedScope();
    return {
      owner: getOwner() as Owner,
      state,
      dispose: () => {
        disposeOwner();
        state.dispose();
      },
    };
  });
}

const [mounted, setMounted] = createSignal<Application | undefined>();

/** Registers the document's application until the returned release runs. */
export function mountApplication(application: Application): () => void {
  if (isServer) {
    throw new Error("Browser application state cannot mount during SSR");
  }
  if (untrack(mounted) !== undefined) {
    throw new Error("A Caret application is already mounted");
  }
  setMounted(() => application);
  return () => {
    if (untrack(mounted) === application) setMounted(undefined);
  };
}

/** Reactive; undefined outside a mounted browser application. */
export function currentApplication(): Application | undefined {
  return mounted();
}

export function requireApplication(): Application {
  const application = mounted();
  if (application === undefined) {
    throw new Error(
      isServer
        ? "Browser application state is unavailable during SSR"
        : "No Caret application is mounted",
    );
  }
  return application;
}

/**
 * Created on first use under the mounted application's root, so its
 * computations, listeners and cleanups end with that application.
 */
const keepOwnedValue = (): void => undefined;

export function createAppOwned<T>(create: () => T): () => T {
  const key = {};
  return () => {
    const application = requireApplication();
    // Hot typing paths read app-owned state many times per keystroke.
    const existing = application.state.peek(key);
    if (existing !== undefined) return existing.value as T;
    return application.state.use(
      key,
      () => runWithOwner(application.owner, create) as T,
      keepOwnedValue,
    );
  };
}

/** An app-owned memo; reads return its current value. */
export function createAppMemo<T>(fn: () => T): () => T {
  const memo = createAppOwned(() => createMemo(fn));
  return () => memo()();
}

const applicationAbort = createAppOwned(() => {
  const controller = new AbortController();
  onCleanup(() =>
    controller.abort(new DOMException("Application disposed", "AbortError")),
  );
  return controller;
});

export function captureApplication(): {
  signal: AbortSignal;
  assertCurrent: () => void;
} {
  const signal = applicationAbort().signal;
  return { signal, assertCurrent: () => signal.throwIfAborted() };
}
