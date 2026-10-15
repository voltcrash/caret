import type { QueryClient } from "@tanstack/solid-query";
import { createSignal, untrack } from "solid-js";
import { isServer } from "solid-js/web";

import type { AccountDataOwner } from "./account-data";

/** Owners of one mounted browser application; SSR renders never register one. */
export type Application = {
  queryClient: QueryClient;
  accountData: AccountDataOwner;
};

const [mounted, setMounted] = createSignal<Application | undefined>();

/** Registers the document's application until the returned release runs. */
export function mountApplication(application: Application): () => void {
  if (isServer) {
    throw new Error("Browser application state cannot mount during SSR");
  }
  if (untrack(mounted) !== undefined) {
    throw new Error("An Oxytype application is already mounted");
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
        : "No Oxytype application is mounted",
    );
  }
  return application;
}
