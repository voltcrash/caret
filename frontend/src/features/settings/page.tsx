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
  highlight: string | undefined;
  onSection: (section: SettingsSection) => void;
}): JSXElement {
  return (
    <ClientOnly fallback={<SettingsLoading />}>
      <Suspense fallback={<SettingsLoading />}>
        <View
          section={props.section}
          highlight={props.highlight}
          onSection={props.onSection}
        />
      </Suspense>
    </ClientOnly>
  );
}
