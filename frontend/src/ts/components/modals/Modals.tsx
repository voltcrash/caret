import {
  Component,
  For,
  JSXElement,
  lazy,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { envConfig } from "virtual:env-config";

import { ModalId, getModalVisibility } from "../../states/modals";
import { runWhenIdle } from "../../utils/idle";
import { CookiesModal } from "./CookiesModal";
import "./modal-triggers";

function lazyModal(
  id: ModalId,
  load: () => Promise<Component>,
): { id: ModalId; Component: ReturnType<typeof lazy<Component>> } {
  return { id, Component: lazy(async () => ({ default: await load() })) };
}

// Loaded on first open (and prefetched when idle) to keep them out of the
// startup bundle. Nested modals live in their parent's chunk.
const lazyModals = [
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
  onMount(() => {
    if (envConfig.isDevelopment) return;
    const cancel = runWhenIdle(() => {
      for (const modal of lazyModals) void modal.Component.preload();
    }, 5000);
    onCleanup(cancel);
  });

  return (
    <>
      <CookiesModal />
      <For each={lazyModals}>
        {(modal) => (
          <Show when={getModalVisibility(modal.id) !== null}>
            <modal.Component />
          </Show>
        )}
      </For>
    </>
  );
}
