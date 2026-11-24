import { For, JSXElement, lazy, onMount, Show, Suspense } from "solid-js";
import { envConfig } from "virtual:env-config";

import { useTypingDevModals } from "../features/typing/modals";
import { getModalVisibility } from "../ts/states/modals";
import { contributedModals } from "./modal-registry";

// oxlint-disable-next-line caret-rules/no-module-let -- Assigned once at module load in development builds.
let DevComponents: (() => JSXElement) | undefined;

if (import.meta.env.DEV) {
  const LazyTanstackDevtools = lazy(async () =>
    import("./tanstack-devtools.client").then((m) => ({
      default: m.TanStackDevtools,
    })),
  );

  const LazySolidDevtoolsOverlay = lazy(async () =>
    import("@solid-devtools/overlay").then((m) => ({
      default: () => {
        onMount(() => {
          m.attachDevtoolsOverlay({
            defaultOpen: false,
            noPadding: true,
          });
        });

        return null;
      },
    })),
  );

  DevComponents = () => {
    useTypingDevModals();

    return (
      <Suspense>
        <Show when={envConfig.devTools}>
          <LazyTanstackDevtools />
          <LazySolidDevtoolsOverlay />
        </Show>
        <For each={contributedModals("dev")}>
          {(modal) => (
            <Show when={getModalVisibility(modal.id) !== null}>
              <modal.Component />
            </Show>
          )}
        </For>
      </Suspense>
    );
  };
}

export function DevTools(): JSXElement {
  return DevComponents?.() ?? null;
}
