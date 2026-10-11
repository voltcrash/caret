import { JSXElement, lazy, onMount, Show, Suspense } from "solid-js";
import { envConfig } from "virtual:env-config";

import { getModalVisibility } from "../../states/modals";

let DevComponents: (() => JSXElement) | undefined;

if (import.meta.env.DEV) {
  const LazyTanstackDevtools = lazy(async () =>
    import("./TanstackDevtools").then((m) => ({
      default: m.TanStackDevtools,
    })),
  );
  const LazyDevOptionsModal = lazy(async () =>
    import("../modals/DevOptionsModal").then((m) => ({
      default: m.DevOptionsModal,
    })),
  );
  const LazyEventLogViewerModal = lazy(async () =>
    import("../modals/EventLogViewerModal").then((m) => ({
      default: m.EventLogViewerModal,
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

  DevComponents = () => (
    <Suspense>
      <Show when={envConfig.devTools}>
        <LazyTanstackDevtools />
        <LazySolidDevtoolsOverlay />
      </Show>
      <Show when={getModalVisibility("DevOptions") !== null}>
        <LazyDevOptionsModal />
      </Show>
      <Show when={getModalVisibility("EventLogViewer") !== null}>
        <LazyEventLogViewerModal />
      </Show>
    </Suspense>
  );
}

export function DevTools(): JSXElement {
  return DevComponents?.() ?? null;
}
