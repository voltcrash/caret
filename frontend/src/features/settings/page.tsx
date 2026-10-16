import { ClientOnly } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import { lazy, Suspense, type JSXElement } from "solid-js";

import type { SettingsSection } from "./tabs";

const View = lazy(
  createClientOnlyFn(async () => ({
    default: (await import("./content.client")).SettingsView,
  })),
);

/** Stable server shell; settings read browser preferences once mounted. */
export function SettingsPage(props: {
  section: SettingsSection;
  highlight: string | undefined;
  onSection: (section: SettingsSection) => void;
}): JSXElement {
  const shell = (
    <section class="grid gap-4" aria-label="Settings">
      <h2 class="text-[1.5em]">{props.section}</h2>
    </section>
  );
  return (
    <ClientOnly fallback={shell}>
      <Suspense fallback={shell}>
        <View
          section={props.section}
          highlight={props.highlight}
          onSection={props.onSection}
        />
      </Suspense>
    </ClientOnly>
  );
}
