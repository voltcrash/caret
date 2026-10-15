import { createSignal, JSXElement } from "solid-js";
import { z } from "zod";

import { exportConfigToJson } from "../../../../config/utils";
import { showModal } from "../../../../states/modals";
import {
  showNoticeNotification,
  showSuccessNotification,
} from "../../../../states/notifications";
import { showSimpleModal } from "../../../../states/simple-modal";
import { Button } from "../../../common/Button";
import { download } from "../../../common/Download";
import { SearchableSetting } from "../SearchableSetting";

export function ImportExport(): JSXElement {
  const [exportedJson, setExportedJson] = createSignal<string>();
  const [isCopying, setIsCopying] = createSignal(false);

  const exportSettings = async (): Promise<void> => {
    if (isCopying()) return;

    const exported = exportedJson();
    if (exported !== undefined) {
      download({
        filename: "settings.json",
        data: new Blob([exported], { type: "application/json" }),
      });
      setExportedJson(undefined);
      return;
    }

    const json = exportConfigToJson();
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(json);
      showSuccessNotification("Settings JSON copied to clipboard");
    } catch {
      showNoticeNotification(
        "Looks like we couldn't copy the config straight to your clipboard. Please copy it manually or use download.",
        { durationMs: 5000 },
      );

      setTimeout(() => {
        showSimpleModal({
          title: "Config JSON",
          class: "max-w-2xl",
          schema: z.object({ json: z.string() }),
          inputs: {
            json: {
              type: "textarea",
              placeholder: "Config JSON",
              initVal: json,
              clickToSelect: true,
              readOnly: true,
              class: "h-50",
            },
          },
          execFn: async () => ({
            status: "success",
            showNotification: false,
          }),
        });
      }, 250);
      // this is flaky, no chaining for simple modals
    } finally {
      setExportedJson(json);
      setIsCopying(false);
    }
  };

  return (
    <SearchableSetting
      key="importExport"
      title="import/export settings"
      description="Import JSON, or export to clipboard and then download a file. Unsupported settings are automatically removed."
      fa={{
        icon: "fa-sliders-h",
      }}
      inputs={
        <div class="grid grid-cols-2 gap-2">
          <Button onClick={() => showModal("ImportSettings")}>import</Button>
          <Button disabled={isCopying()} onClick={() => void exportSettings()}>
            {exportedJson() === undefined ? "export" : "download"}
          </Button>
        </div>
      }
    />
  );
}
