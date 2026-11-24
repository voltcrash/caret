import { onCleanup } from "solid-js";

import { lazyModal, registerModals } from "#app/modal-registry.ts";

/** Contributes lazy typing modals to the mounted app modal host. */
export function useTypingModals(): void {
  onCleanup(
    registerModals("app", [
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
        import("./CustomTestDurationModal").then(
          (m) => m.CustomTestDurationModal,
        ),
      ),
      lazyModal("CustomWordAmount", async () =>
        import("./CustomWordAmountModal").then((m) => m.CustomWordAmountModal),
      ),
      lazyModal("ShareTestSettings", async () =>
        import("./ShareTestSettings").then((m) => m.ShareTestSettings),
      ),
      lazyModal("MobileTestConfig", async () =>
        import("./MobileTestConfigModal").then((m) => m.MobileTestConfigModal),
      ),
      lazyModal("LastSignedOutResult", async () =>
        import("./LastSignedOutResultModal").then(
          (m) => m.LastSignedOutResultModal,
        ),
      ),
      lazyModal("EditResultTags", async () =>
        import("./EditResultTagsModal").then((m) => m.EditResultTagsModal),
      ),
      lazyModal("PractiseWords", async () =>
        import("./PractiseWordsModal").then((m) => m.PractiseWordsModal),
      ),
    ]),
  );
}
