import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

import { AnimatedModal } from "../../../src/ts/components/common/AnimatedModal";
import {
  hideModal,
  hideModalAndClearChain,
  showModal,
} from "../../../src/ts/states/modals";

beforeEach(() => {
  hideModalAndClearChain("Support");
  hideModalAndClearChain("Contact");
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.open = true;
    this.querySelector<HTMLElement>("button, input, textarea, select")?.focus();
  });
  HTMLDialogElement.prototype.show = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
    length: 1,
  } as DOMRectList);
});
afterEach(() => {
  cleanup();
  hideModalAndClearChain("Support");
  hideModalAndClearChain("Contact");
  vi.restoreAllMocks();
});

function renderFocusModal(mode: "modal" | "dialog" = "modal"): void {
  render(() => (
    <>
      <button type="button" onClick={() => showModal("Support")}>
        Open support
      </button>
      <AnimatedModal
        id="Support"
        title="Support settings"
        mode={mode}
        animationMode="none"
        focusFirstInput={true}
      >
        <input aria-label="Support name" />
        <button type="button" disabled>
          Disabled control
        </button>
        <button type="button" onClick={() => hideModal("Support")}>
          Close support
        </button>
      </AnimatedModal>
    </>
  ));
}
async function openSupport(): Promise<void> {
  const trigger = screen.getByRole("button", { name: "Open support" });
  trigger.focus();
  fireEvent.click(trigger);
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Support name" })).toHaveFocus(),
  );
}

describe("modal focus", () => {
  it("names the dialog and initially focuses its input", async () => {
    renderFocusModal();
    await openSupport();
    expect(
      screen.getByRole("dialog", { name: "Support settings" }),
    ).toHaveAttribute("aria-modal", "true");
  });

  it("wraps Shift+Tab from the first control to the last enabled control", async () => {
    renderFocusModal();
    await openSupport();
    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Tab",
      shiftKey: true,
    });
    expect(screen.getByRole("button", { name: "Close support" })).toHaveFocus();
  });

  it("wraps Tab from the last control to the first", async () => {
    renderFocusModal();
    await openSupport();
    const last = screen.getByRole("button", { name: "Close support" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("returns focus to the connected trigger on close", async () => {
    renderFocusModal();
    await openSupport();
    fireEvent.click(screen.getByRole("button", { name: "Close support" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Open support" }),
      ).toHaveFocus(),
    );
  });
});
