import { JSXElement, lazy, Show, Suspense } from "solid-js";

import { getModalVisibility } from "../../states/modals";

const AlertsPopup = lazy(async () =>
  import("./alerts/AlertsPopup").then((m) => ({ default: m.AlertsPopup })),
);

export function Popups(): JSXElement {
  return (
    <Show when={getModalVisibility("Alerts") !== null}>
      <Suspense>
        <AlertsPopup />
      </Suspense>
    </Show>
  );
}
