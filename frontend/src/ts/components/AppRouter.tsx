import { Router } from "@solidjs/router";
import { JSXElement } from "solid-js";
import { envConfig } from "virtual:env-config";

import { LegacyRuntime } from "../../app/legacy-runtime.client";
import { AppProviders } from "../../app/providers";
import { createQueryClient } from "../../app/query-client";
import { appRoutes } from "../navigation/routes";
import { App } from "./App";
import { AppElements } from "./core/AppEffects";
import { NavigationRuntime } from "./core/NavigationRuntime";

export function AppRouter(props: AppElements): JSXElement {
  return (
    <AppProviders
      queryClient={createQueryClient({
        staleTime: 0,
        retry: envConfig.devOffline ? false : 3,
      })}
    >
      <LegacyRuntime />
      <Router
        explicitLinks
        preload={false}
        root={(route) => (
          <>
            <NavigationRuntime />
            {route.children}
            <App {...props} />
          </>
        )}
      >
        {appRoutes}
      </Router>
    </AppProviders>
  );
}
