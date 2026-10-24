import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import "../../__harness__/mock-static";
import { ImportSettingsModal } from "../../../src/ts/components/modals/ImportSettingsModal";
import { applyConfigFromJson } from "../../../src/ts/config/lifecycle";
import {
  hideModalAndClearChain,
  isModalOpen,
  showModal,
} from "../../../src/ts/states/modals";

vi.mock("../../../src/ts/config/lifecycle", () => ({
  applyConfigFromJson: vi.fn(),
}));

const applyConfig = vi.mocked(applyConfigFromJson);

beforeEach(() => {
  applyConfig.mockReset().mockResolvedValue(true);
  hideModalAndClearChain("ImportSettings");
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});

afterEach(() => {
  cleanup();
  hideModalAndClearChain("ImportSettings");
  vi.restoreAllMocks();
});

async function renderImport(): Promise<ReturnType<typeof render>> {
  const view = render(() => <ImportSettingsModal />);
  showModal("ImportSettings");
  await view.findByRole("textbox", { name: "settings JSON" });
  return view;
}

it("imports pasted JSON and closes only after it succeeds", async () => {
  let complete: ((success: boolean) => void) | undefined;
  applyConfig.mockImplementation(
    async () => new Promise<boolean>((resolve) => (complete = resolve)),
  );
  const view = await renderImport();
  const editor = view.getByRole("textbox", { name: "settings JSON" });
  expect(view.getByRole("button", { name: "import settings" })).toBeDisabled();
  fireEvent.input(editor, { target: { value: '{"theme":"nord"}' } });
  fireEvent.click(view.getByRole("button", { name: "import settings" }));

  expect(applyConfig).toHaveBeenCalledWith('{"theme":"nord"}');
  expect(editor).toBeDisabled();
  expect(view.getByRole("button", { name: "importing..." })).toBeDisabled();
  expect(isModalOpen("ImportSettings")).toBe(true);
  complete?.(true);
  await waitFor(() => expect(isModalOpen("ImportSettings")).toBe(false));
});

it("opens the file picker and loads a formatted JSON preview before importing", async () => {
  const click = vi
    .spyOn(HTMLInputElement.prototype, "click")
    .mockImplementation(() => undefined);
  const view = await renderImport();
  fireEvent.click(view.getByRole("button", { name: "choose file" }));
  expect(click).toHaveBeenCalledOnce();

  const file = new File(['\uFEFF{"theme":"nord","time":60}'], "settings.json", {
    type: "application/json",
  });
  fireEvent.change(view.getByLabelText("Choose settings JSON file"), {
    target: { files: [file] },
  });
  const formatted = '{\n  "theme": "nord",\n  "time": 60\n}';
  await waitFor(() =>
    expect(view.getByRole("textbox", { name: "settings JSON" })).toHaveValue(
      formatted,
    ),
  );
  expect(view.getByText("settings.json")).toBeInTheDocument();
  expect(applyConfig).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "import settings" }));
  expect(applyConfig).toHaveBeenCalledWith(formatted);
});

it("loads a dropped JSON file into the editor", async () => {
  const view = await renderImport();
  const zone = view.getByRole("region", { name: "JSON file upload" });
  fireEvent.dragEnter(zone);
  expect(view.getByText("Release to load your file")).toBeInTheDocument();
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(new File(['{"time":15}'], "my-settings.json"));
  zone.dispatchEvent(
    new DragEvent("drop", { dataTransfer, bubbles: true, cancelable: true }),
  );
  await waitFor(() =>
    expect(view.getByRole("textbox", { name: "settings JSON" })).toHaveValue(
      '{\n  "time": 15\n}',
    ),
  );
  expect(view.getByText("Drop your JSON file here")).toBeInTheDocument();
  expect(view.getByText("my-settings.json")).toBeInTheDocument();
  expect(applyConfig).not.toHaveBeenCalled();
});

it.each(['{"theme":', "[]", "null", "42"])(
  "keeps invalid JSON %s open for correction",
  async (json) => {
    const view = await renderImport();
    fireEvent.input(view.getByRole("textbox", { name: "settings JSON" }), {
      target: { value: json },
    });
    fireEvent.click(view.getByRole("button", { name: "import settings" }));
    expect(view.getByRole("alert")).toBeInTheDocument();
    expect(isModalOpen("ImportSettings")).toBe(true);
    expect(applyConfig).not.toHaveBeenCalled();

    fireEvent.input(view.getByRole("textbox", { name: "settings JSON" }), {
      target: { value: '{"time":30}' },
    });
    expect(view.queryByRole("alert")).toBeNull();
  },
);

it("keeps the draft when settings could not be applied", async () => {
  applyConfig.mockResolvedValue(false);
  const view = await renderImport();
  fireEvent.input(view.getByRole("textbox", { name: "settings JSON" }), {
    target: { value: '{"time":30}' },
  });
  fireEvent.click(view.getByRole("button", { name: "import settings" }));
  expect(await view.findByRole("alert")).toHaveTextContent("Couldn't import");
  expect(isModalOpen("ImportSettings")).toBe(true);
  expect(view.getByRole("textbox", { name: "settings JSON" })).toHaveValue(
    '{"time":30}',
  );
});

it("rejects multiple files without overwriting the draft", async () => {
  const view = await renderImport();
  fireEvent.input(view.getByRole("textbox", { name: "settings JSON" }), {
    target: { value: '{"time":30}' },
  });
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(new File(["{}"], "one.json"));
  dataTransfer.items.add(new File(["{}"], "two.json"));
  view
    .getByRole("region", { name: "JSON file upload" })
    .dispatchEvent(
      new DragEvent("drop", { dataTransfer, bubbles: true, cancelable: true }),
    );
  expect(view.getByRole("alert")).toHaveTextContent("one JSON file at a time");
  expect(view.getByRole("textbox", { name: "settings JSON" })).toHaveValue(
    '{"time":30}',
  );
  expect(applyConfig).not.toHaveBeenCalled();
});

it("shows invalid file contents for correction without applying them", async () => {
  const view = await renderImport();
  fireEvent.change(view.getByLabelText("Choose settings JSON file"), {
    target: { files: [new File(["not JSON"], "broken.json")] },
  });
  expect(await view.findByRole("alert")).toHaveTextContent("Invalid JSON");
  expect(view.getByRole("textbox", { name: "settings JSON" })).toHaveValue(
    "not JSON",
  );
  expect(isModalOpen("ImportSettings")).toBe(true);
  expect(applyConfig).not.toHaveBeenCalled();
});
