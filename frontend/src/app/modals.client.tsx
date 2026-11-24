import { createMemo, For, JSXElement, Show } from "solid-js";

import { useTypingModals } from "../features/typing/modals";
import { getModalVisibility } from "../ts/states/modals";
import { contributedModals, lazyModal } from "./modal-registry";

// Loaded on first open to keep them out of the
// startup bundle. Nested modals live in their parent's chunk.
const coreModals = [
  lazyModal("Cookies", async () =>
    import("../ts/components/modals/CookiesModal").then((m) => m.CookiesModal),
  ),
  lazyModal("Commandline", async () =>
    import("./commandline.client").then((m) => m.CommandlineHost),
  ),
  lazyModal("SimpleModal", async () =>
    import("../ts/components/modals/SimpleModal").then((m) => m.SimpleModal),
  ),
  lazyModal("ImportSettings", async () =>
    import("../ts/components/modals/ImportSettingsModal").then(
      (m) => m.ImportSettingsModal,
    ),
  ),
  lazyModal("PbTables", async () =>
    import("../ts/components/modals/PbTablesModal").then(
      (m) => m.PbTablesModal,
    ),
  ),
  lazyModal("AddPresetModal", async () =>
    import("../ts/components/modals/preset/AddPresetModal").then(
      (m) => m.AddPresetModal,
    ),
  ),
  lazyModal("EditPresetModal", async () =>
    import("../ts/components/modals/preset/EditPresetModal").then(
      (m) => m.EditPresetModal,
    ),
  ),
  lazyModal("StreakHourOffset", async () =>
    import("../ts/components/modals/StreakHourOffsetModal").then(
      (m) => m.StreakHourOffsetModal,
    ),
  ),
  lazyModal("UserReport", async () =>
    import("../ts/components/modals/UserReportModal").then(
      (m) => m.UserReportModal,
    ),
  ),
];

export function Modals(): JSXElement {
  useTypingModals();
  const modals = createMemo(() => [...coreModals, ...contributedModals("app")]);

  return (
    <For each={modals()}>
      {(modal) => (
        <Show when={getModalVisibility(modal.id) !== null}>
          <modal.Component />
        </Show>
      )}
    </For>
  );
}
