import { Component, For, JSXElement, lazy, Show } from "solid-js";

import { ModalId, getModalVisibility } from "../../states/modals";
import { useModalTriggers } from "./modal-triggers";

function lazyModal(
  id: ModalId,
  load: () => Promise<Component>,
): { id: ModalId; Component: ReturnType<typeof lazy<Component>> } {
  return { id, Component: lazy(async () => ({ default: await load() })) };
}

// Loaded on first open to keep them out of the
// startup bundle. Nested modals live in their parent's chunk.
const lazyModals = [
  lazyModal("Cookies", async () =>
    import("./CookiesModal").then((m) => m.CookiesModal),
  ),
  lazyModal("Commandline", async () =>
    import("./Commandline").then((m) => m.Commandline),
  ),
  lazyModal("VersionHistory", async () =>
    import("./VersionHistoryModal").then((m) => m.VersionHistoryModal),
  ),
  lazyModal("Contact", async () =>
    import("./ContactModal").then((m) => m.ContactModal),
  ),
  lazyModal("Support", async () =>
    import("./SupportModal").then((m) => m.SupportModal),
  ),
  lazyModal("SimpleModal", async () =>
    import("./SimpleModal").then((m) => m.SimpleModal),
  ),
  lazyModal("ImportSettings", async () =>
    import("./ImportSettingsModal").then((m) => m.ImportSettingsModal),
  ),
  lazyModal("CustomText", async () =>
    import("./CustomTextModal").then((m) => m.CustomTextModal),
  ),
  lazyModal("QuoteRate", async () =>
    import("./QuoteRateModal").then((m) => m.QuoteRateModal),
  ),
  lazyModal("QuoteReport", async () =>
    import("./QuoteReportModal").then((m) => m.QuoteReportModal),
  ),
  lazyModal("QuoteSearch", async () =>
    import("./QuoteSearchModal").then((m) => m.QuoteSearchModal),
  ),
  lazyModal("TestDuration", async () =>
    import("./CustomTestDurationModal").then((m) => m.CustomTestDurationModal),
  ),
  lazyModal("CustomWordAmount", async () =>
    import("./CustomWordAmountModal").then((m) => m.CustomWordAmountModal),
  ),
  lazyModal("PbTables", async () =>
    import("./PbTablesModal").then((m) => m.PbTablesModal),
  ),
  lazyModal("ShareTestSettings", async () =>
    import("./ShareTestSettings").then((m) => m.ShareTestSettings),
  ),
  lazyModal("MobileTestConfig", async () =>
    import("./MobileTestConfigModal").then((m) => m.MobileTestConfigModal),
  ),
  lazyModal("AddPresetModal", async () =>
    import("./preset/AddPresetModal").then((m) => m.AddPresetModal),
  ),
  lazyModal("EditPresetModal", async () =>
    import("./preset/EditPresetModal").then((m) => m.EditPresetModal),
  ),
  lazyModal("LastSignedOutResult", async () =>
    import("./LastSignedOutResultModal").then(
      (m) => m.LastSignedOutResultModal,
    ),
  ),
  lazyModal("StreakHourOffset", async () =>
    import("./StreakHourOffsetModal").then((m) => m.StreakHourOffsetModal),
  ),
  lazyModal("GoogleSignup", async () =>
    import("./GoogleSignUpModal").then((m) => m.GoogleSignupModal),
  ),
  lazyModal("UserReport", async () =>
    import("./UserReportModal").then((m) => m.UserReportModal),
  ),
  lazyModal("EditResultTags", async () =>
    import("./EditResultTagsModal").then((m) => m.EditResultTagsModal),
  ),
  lazyModal("PractiseWords", async () =>
    import("./PractiseWordsModal").then((m) => m.PractiseWordsModal),
  ),
];

export function Modals(): JSXElement {
  useModalTriggers();
  return (
    <For each={lazyModals}>
      {(modal) => (
        <Show when={getModalVisibility(modal.id) !== null}>
          <modal.Component />
        </Show>
      )}
    </For>
  );
}
