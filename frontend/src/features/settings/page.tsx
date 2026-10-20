import { ClientOnly } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import { lazy, Suspense, type JSXElement } from "solid-js";

import type { SettingsSection } from "./tabs";

import { SettingsLoading } from "./loading";

const View = lazy(
  createClientOnlyFn(async () => ({
    default: (await import("./content.client")).SettingsView,
  })),
);
// Warm browser code during route preload; preferences still mount on navigation.
if (!import.meta.env.SSR) void View.preload();

/** Stable server shell; settings read browser preferences once mounted. */
export function SettingsPage(props: {
  section: SettingsSection;
  authenticated: boolean;
  highlight: string | undefined;
  onSection: (section: SettingsSection) => void;
}): JSXElement {
  const loading = () => (
    <SettingsLoading
      section={props.section}
      authenticated={props.authenticated}
    />
  );
  return (
    <ClientOnly fallback={loading()}>
      <Suspense fallback={loading()}>
        <View
          section={props.section}
          authenticated={props.authenticated}
          highlight={props.highlight}
          onSection={props.onSection}
        />
      </Suspense>
    </ClientOnly>
  );
}
