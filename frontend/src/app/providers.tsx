import { QueryClientProvider, type QueryClient } from "@tanstack/solid-query";
import { type JSXElement, onCleanup, untrack } from "solid-js";
import { isServer } from "solid-js/web";

import { createAccountDataOwner } from "./account-data";
import {
  type Application,
  createApplicationRoot,
  mountApplication,
} from "./application";

/** Creates this render's owners; only a browser render registers them. */
export function AppProviders(props: {
  queryClient: QueryClient;
  children: JSXElement;
}): JSXElement {
  const root = createApplicationRoot();
  const application: Application = {
    owner: root.owner,
    state: root.state,
    // The router/app owner supplies one client for this render's lifetime.
    // oxlint-disable-next-line solid/reactivity -- Owners bind once per mount.
    queryClient: props.queryClient,
    accountData: createAccountDataOwner(untrack(() => props.queryClient)),
  };
  const release = isServer ? undefined : mountApplication(application);
  onCleanup(() => {
    application.accountData.dispose();
    root.dispose();
    if (!isServer) application.queryClient.clear();
    release?.();
  });
  return (
    <QueryClientProvider client={application.queryClient}>
      {props.children}
    </QueryClientProvider>
  );
}
