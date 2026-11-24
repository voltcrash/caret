import { createMemo, For, JSXElement, Show } from "solid-js";

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
  lazyModal("CustomText", async () =>
    import("../features/typing/modals/CustomTextModal").then(
      (m) => m.CustomTextModal,
    ),
  ),
  lazyModal("QuoteRate", async () =>
    import("../features/typing/modals/QuoteRateModal").then(
      (m) => m.QuoteRateModal,
    ),
  ),
  lazyModal("QuoteReport", async () =>
    import("../features/typing/modals/QuoteReportModal").then(
      (m) => m.QuoteReportModal,
    ),
  ),
  lazyModal("QuoteSearch", async () =>
    import("../features/typing/modals/QuoteSearchModal").then(
      (m) => m.QuoteSearchModal,
    ),
  ),
  lazyModal("TestDuration", async () =>
    import("../features/typing/modals/CustomTestDurationModal").then(
      (m) => m.CustomTestDurationModal,
    ),
  ),
  lazyModal("CustomWordAmount", async () =>
    import("../features/typing/modals/CustomWordAmountModal").then(
      (m) => m.CustomWordAmountModal,
    ),
  ),
  lazyModal("PbTables", async () =>
    import("../ts/components/modals/PbTablesModal").then(
      (m) => m.PbTablesModal,
    ),
  ),
  lazyModal("ShareTestSettings", async () =>
    import("../features/typing/modals/ShareTestSettings").then(
      (m) => m.ShareTestSettings,
    ),
  ),
  lazyModal("MobileTestConfig", async () =>
    import("../features/typing/modals/MobileTestConfigModal").then(
      (m) => m.MobileTestConfigModal,
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
  lazyModal("LastSignedOutResult", async () =>
    import("../features/typing/modals/LastSignedOutResultModal").then(
      (m) => m.LastSignedOutResultModal,
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
  lazyModal("EditResultTags", async () =>
    import("../features/typing/modals/EditResultTagsModal").then(
      (m) => m.EditResultTagsModal,
    ),
  ),
  lazyModal("PractiseWords", async () =>
    import("../features/typing/modals/PractiseWordsModal").then(
      (m) => m.PractiseWordsModal,
    ),
  ),
];

export function Modals(): JSXElement {
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
