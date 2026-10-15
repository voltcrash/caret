import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import "../../../__harness__/mock-static";
import { Download } from "../../../../src/ts/components/common/Download";
import { ImportExport } from "../../../../src/ts/components/pages/settings/custom-setting/ImportExport";
import { getMutableConfig } from "../../../../src/ts/config/store";
import { getDefaultConfig } from "../../../../src/ts/constants/default-config";
import {
  hideModalAndClearChain,
  isModalOpen,
} from "../../../../src/ts/states/modals";
import * as Notifications from "../../../../src/ts/states/notifications";
import * as SimpleModal from "../../../../src/ts/states/simple-modal";

vi.mock("../../../../src/ts/config/lifecycle", () => ({
  applyConfigFromJson: vi.fn(),
}));

const writeText = vi.fn<(text: string) => Promise<void>>();
const createObjectURL = vi.fn((_data: Blob) => "blob:settings");

beforeEach(() => {
  Object.assign(getMutableConfig(), getDefaultConfig());
  writeText.mockReset().mockResolvedValue();
  createObjectURL.mockClear();
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
  vi.spyOn(Notifications, "showSuccessNotification").mockReturnValue(0);
  vi.spyOn(Notifications, "showNoticeNotification").mockReturnValue(0);
  vi.spyOn(SimpleModal, "showSimpleModal").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  hideModalAndClearChain("ImportSettings");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("opens the file and JSON import modal", () => {
  const view = renderExport();
  fireEvent.click(view.getByRole("button", { name: "import" }));
  expect(isModalOpen("ImportSettings")).toBe(true);
});

function renderExport(): ReturnType<typeof render> {
  return render(() => (
    <>
      <Download />
      <ImportExport />
    </>
  ));
}

async function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Expected text from the downloaded Blob"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

it("copies clean JSON, then downloads that same snapshot as settings.json", async () => {
  Object.assign(getMutableConfig(), {
    theme: "miami_nights",
    ads: "result",
    monkey: true,
  });
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("settings.json");
      expect(this.href).toBe("blob:settings");
    });
  const view = renderExport();

  fireEvent.click(view.getByRole("button", { name: "export" }));
  await waitFor(() =>
    expect(view.getByRole("button", { name: "download" })).toBeEnabled(),
  );
  expect(Notifications.showSuccessNotification).toHaveBeenCalledWith(
    "Settings JSON copied to clipboard",
  );
  expect(createObjectURL).not.toHaveBeenCalled();

  const copied = writeText.mock.calls[0]?.[0];
  expect(copied).toContain('\n  "theme": "miami_nights"');
  expect(copied).toContain('"customLayoutfluid": [\n    "qwerty",');
  expect(copied).not.toContain('"ads":');
  expect(copied).not.toContain('"monkey":');
  getMutableConfig().theme = "nord";

  fireEvent.click(view.getByRole("button", { name: "download" }));
  const blob = createObjectURL.mock.calls[0]?.[0];
  if (blob === undefined) throw new Error("Download did not receive a Blob");
  expect(blob.type).toBe("application/json");
  expect(await readBlob(blob)).toBe(copied);
  expect(click).toHaveBeenCalledOnce();
  expect(writeText).toHaveBeenCalledOnce();
  expect(view.getByRole("button", { name: "export" })).toBeEnabled();
});

it("disables export until copying completes", async () => {
  let finishCopy: (() => void) | undefined;
  writeText.mockImplementation(
    async () => new Promise<void>((resolve) => (finishCopy = resolve)),
  );
  const view = renderExport();
  const button = view.getByRole("button", { name: "export" });

  fireEvent.click(button);
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(writeText).toHaveBeenCalledOnce();
  expect(createObjectURL).not.toHaveBeenCalled();

  finishCopy?.();
  await waitFor(() =>
    expect(view.getByRole("button", { name: "download" })).toBeEnabled(),
  );
});

it("allows downloading when clipboard copying fails", async () => {
  vi.useFakeTimers();
  writeText.mockRejectedValue(new Error("Clipboard unavailable"));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
    () => undefined,
  );
  const view = renderExport();

  fireEvent.click(view.getByRole("button", { name: "export" }));
  await vi.advanceTimersByTimeAsync(250);

  expect(Notifications.showSuccessNotification).not.toHaveBeenCalled();
  expect(Notifications.showNoticeNotification).toHaveBeenCalled();
  expect(SimpleModal.showSimpleModal).toHaveBeenCalledWith(
    expect.objectContaining({
      inputs: {
        json: expect.objectContaining({
          initVal: writeText.mock.calls[0]?.[0],
        }),
      },
    }),
  );
  fireEvent.click(view.getByRole("button", { name: "download" }));
  expect(createObjectURL).toHaveBeenCalledOnce();
  expect(view.getByRole("button", { name: "export" })).toBeEnabled();
});
