import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import { AnimationParams } from "animejs";
import { createSignal } from "solid-js";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vite-plus/test";

const { animations } = vi.hoisted(() => ({
  animations: [] as { element: HTMLElement; params: AnimationParams }[],
}));

vi.mock("animejs", async (original) => ({
  ...(await original<typeof import("animejs")>()),
  animate: (element: HTMLElement, params: AnimationParams) => {
    animations.push({ element, params });
    return { cancel: vi.fn() };
  },
}));

vi.mock("../../../src/ts/utils/misc", () => ({
  applyReducedMotion: (duration: number) => duration,
}));

import { AnimatedModal } from "../../../src/ts/components/common/AnimatedModal";
import {
  hideModal,
  hideModalAndClearChain,
  isModalOpen,
  showModal,
} from "../../../src/ts/states/modals";
import { isAnyPopupVisible } from "../../../src/ts/states/overlay-visibility";

async function completeAnimation(): Promise<void> {
  // @ts-expect-error callback arguments unused by modal lifecycle
  await animations.at(-1)?.params.onComplete?.();
}

describe("AnimatedModal", () => {
  let displayStyles: HTMLStyleElement;

  beforeEach(() => {
    hideModalAndClearChain("QuoteRate");
    hideModalAndClearChain("QuoteReport");
    showModal("QuoteRate");
    vi.clearAllMocks();
    animations.length = 0;
    // Model display utilities without loading the full app CSS in this unit test.
    displayStyles = document.createElement("style");
    displayStyles.textContent = `
      dialog { display: none; }
      dialog.flex { display: flex; }
      dialog.hidden { display: none; }
      dialog.open\\:flex[open] { display: flex; }
    `;
    document.head.append(displayStyles);

    // Control dialog transitions; browser/lifecycle covers native modal behavior.
    HTMLDialogElement.prototype.showModal = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.open = true;
    });
    HTMLDialogElement.prototype.show = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.open = false;
    });
  });

  afterEach(() => {
    cleanup();
    hideModalAndClearChain("QuoteRate");
    hideModalAndClearChain("QuoteReport");
    displayStyles.remove();
  });

  function renderModal(props: {
    onEscape?: (e: KeyboardEvent) => void;
    onBackdropClick?: (e: MouseEvent) => void;
    wrapperClass?: string;
    beforeShow?: () => void | Promise<void>;
    afterShow?: () => void | Promise<void>;
    beforeHide?: () => void | Promise<void>;
    afterHide?: () => void | Promise<void>;
    animationMode?: "none" | "both" | "modalOnly";
    mode?: "modal" | "dialog";
  }): {
    container: HTMLElement;
    dialog: HTMLDialogElement;
    modalDiv: HTMLDivElement | null;
  } {
    const { container } = render(() => (
      <AnimatedModal
        id="QuoteRate"
        {...props}
        wrapperClass={props.wrapperClass}
      >
        <div data-testid="modal-content">Test Content</div>
      </AnimatedModal>
    ));

    const dialog = container.querySelector("dialog");
    if (dialog === null) throw new Error("Missing fixture dialog");
    vi.spyOn(dialog, "getClientRects").mockImplementation(
      () =>
        ({
          length: getComputedStyle(dialog).display === "none" ? 0 : 1,
        }) as DOMRectList,
    );

    const wrapper = container.firstElementChild;
    const modalDiv = container.querySelector<HTMLDivElement>(".modal");
    if (!(wrapper instanceof HTMLElement)) {
      throw new Error("Missing fixture modal content");
    }
    return { container: wrapper, dialog, modalDiv };
  }

  it("renders dialog with correct id and class", () => {
    const { dialog } = renderModal({});

    expect(dialog).toHaveAttribute("id", "QuoteRateModal");
  });

  it("renders children inside modal div", () => {
    const { modalDiv } = renderModal({});
    if (modalDiv === null) throw new Error("Missing fixture modal content");

    expect(
      modalDiv.querySelector("[data-testid='modal-content']"),
    ).toHaveTextContent("Test Content");
  });

  it("doesnt render children if not open", () => {
    hideModal("QuoteRate");
    const { modalDiv } = renderModal({});

    expect(modalDiv).not.toBeInTheDocument();
  });

  it("has escape handler attached", () => {
    const { dialog } = renderModal({});

    expect(dialog.onkeydown).toBeDefined();
  });

  it("has backdrop click handler attached", () => {
    const { dialog } = renderModal({});

    expect(dialog.onmousedown).toBeDefined();
  });

  it("applies custom class to dialog", () => {
    const { dialog } = renderModal({
      wrapperClass: "customClass",
    });

    expect(dialog).toHaveClass("customClass");
  });

  it("renders with animationMode none", () => {
    const { dialog } = renderModal({
      animationMode: "none",
    });

    expect(dialog).toHaveAttribute("id", "QuoteRateModal");
  });

  it("opens the native dialog after preparation", async () => {
    const beforeShow = vi.fn();
    const afterShow = vi.fn();
    const { dialog } = renderModal({ beforeShow, afterShow });

    await waitFor(() => expect(dialog.open).toBe(true));
    expect(beforeShow).toHaveBeenCalledOnce();
    expect(afterShow).not.toHaveBeenCalled();
    await completeAnimation();
    expect(afterShow).toHaveBeenCalledOnce();
  });

  it("closes the native dialog when its exit animation finishes", async () => {
    const afterHide = vi.fn();
    const { dialog } = renderModal({ afterHide });
    await waitFor(() => expect(dialog.open).toBe(true));
    await completeAnimation();

    hideModal("QuoteRate");
    await waitFor(() => expect(animations).toHaveLength(4));
    expect(dialog.open).toBe(true);
    expect(afterHide).not.toHaveBeenCalled();
    await completeAnimation();

    expect(dialog.open).toBe(false);
    expect(afterHide).toHaveBeenCalledOnce();
  });

  it("closes without animation when animationMode is none", async () => {
    const afterHide = vi.fn();
    const { dialog } = renderModal({ animationMode: "none", afterHide });
    await waitFor(() => expect(dialog.open).toBe(true));

    hideModal("QuoteRate");
    await waitFor(() => expect(dialog.open).toBe(false));
    expect(afterHide).toHaveBeenCalledOnce();
    expect(animations).toHaveLength(0);
  });

  it("closes an open native dialog on unmount", async () => {
    const { dialog } = renderModal({});
    await waitFor(() => expect(dialog.open).toBe(true));

    cleanup();

    expect(dialog.open).toBe(false);
  });

  it("keeps an unopened dialog out of overlay detection", () => {
    hideModal("QuoteRate");
    const { dialog } = renderModal({});

    expect(getComputedStyle(dialog).display).toBe("none");
    expect(isAnyPopupVisible()).toBe(false);
  });

  it.each(["both", "modalOnly", "none"] as const)(
    "stays hidden after reactive afterHide updates (%s)",
    async (animationMode) => {
      const [wrapperClass, setWrapperClass] = createSignal("bg-transparent");
      const { dialog } = renderModal({
        animationMode,
        get wrapperClass() {
          return wrapperClass();
        },
        afterHide: () => {
          setWrapperClass("");
        },
      });
      await waitFor(() => expect(dialog.open).toBe(true));
      if (animationMode !== "none") await completeAnimation();
      expect(isAnyPopupVisible()).toBe(true);
      animations.length = 0;

      hideModal("QuoteRate");
      if (animationMode !== "none") {
        await waitFor(() => expect(animations.length).toBeGreaterThan(0));
        await completeAnimation();
      }
      await waitFor(() => expect(dialog.open).toBe(false));

      expect(getComputedStyle(dialog).display).toBe("none");
      expect(isAnyPopupVisible()).toBe(false);
      setWrapperClass("bg-transparent");
      expect(isAnyPopupVisible()).toBe(false);

      showModal("QuoteRate");
      await waitFor(() => expect(dialog.open).toBe(true));
      expect(getComputedStyle(dialog).display).toBe("flex");
    },
  );

  it.each(["escape", "backdrop"] as const)(
    "releases the overlay after %s dismissal and repeated opens",
    async (dismissal) => {
      const afterHide = vi.fn();
      const { dialog } = renderModal({ afterHide });

      for (let cycle = 0; cycle < 3; cycle++) {
        await waitFor(() => expect(dialog.open).toBe(true));
        await completeAnimation();
        animations.length = 0;

        if (dismissal === "escape") {
          fireEvent.keyDown(dialog, { key: "Escape" });
        } else {
          fireEvent.mouseDown(dialog);
        }
        await waitFor(() => expect(animations).toHaveLength(2));
        await completeAnimation();

        expect(dialog.open).toBe(false);
        expect(isAnyPopupVisible()).toBe(false);
        expect(afterHide).toHaveBeenCalledTimes(cycle + 1);
        if (cycle < 2) showModal("QuoteRate");
      }
    },
  );

  it("hides non-modal dialogs after reactive wrapper updates", async () => {
    const [wrapperClass, setWrapperClass] = createSignal("items-end");
    const { dialog } = renderModal({
      mode: "dialog",
      animationMode: "none",
      get wrapperClass() {
        return wrapperClass();
      },
      afterHide: () => {
        setWrapperClass("items-center");
      },
    });
    await waitFor(() => expect(dialog.open).toBe(true));
    expect(HTMLDialogElement.prototype.show).toHaveBeenCalledOnce();
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();

    hideModal("QuoteRate");
    await waitFor(() => expect(dialog.open).toBe(false));

    expect(getComputedStyle(dialog).display).toBe("none");
    expect(isAnyPopupVisible()).toBe(false);
  });

  it("closes and restores chained dialogs without leaving visible wrappers", async () => {
    const { container } = render(() => (
      <>
        <AnimatedModal id="QuoteRate">QuoteRate content</AnimatedModal>
        <AnimatedModal id="QuoteReport">QuoteReport content</AnimatedModal>
      </>
    ));
    const support = container.querySelector(
      "#QuoteRateModal",
    ) as HTMLDialogElement;
    const contact = container.querySelector(
      "#QuoteReportModal",
    ) as HTMLDialogElement;
    await waitFor(() => expect(support.open).toBe(true));
    await completeAnimation();
    animations.length = 0;

    showModal("QuoteReport");
    await waitFor(() => expect(animations).toHaveLength(1));
    await completeAnimation();
    await waitFor(() => expect(contact.open).toBe(true));
    expect(support.open).toBe(false);
    expect(getComputedStyle(support).display).toBe("none");
    await completeAnimation();
    animations.length = 0;

    hideModal("QuoteReport");
    await waitFor(() => expect(animations).toHaveLength(1));
    await completeAnimation();
    await waitFor(() => expect(support.open).toBe(true));
    expect(contact.open).toBe(false);
    expect(getComputedStyle(contact).display).toBe("none");
    await completeAnimation();
    animations.length = 0;

    hideModal("QuoteRate");
    await waitFor(() => expect(animations).toHaveLength(2));
    await completeAnimation();
    expect(support.open).toBe(false);
    expect(getComputedStyle(support).display).toBe("none");
    expect(getComputedStyle(contact).display).toBe("none");
  });

  describe("sheet gestures", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true })),
      );
    });

    afterEach(() => vi.unstubAllGlobals());

    async function openSheet(onBackdropClick = vi.fn()): Promise<{
      handle: HTMLElement;
      dialog: HTMLDialogElement;
      onBackdropClick: ReturnType<typeof vi.fn>;
    }> {
      const { dialog, modalDiv } = renderModal({ onBackdropClick });
      await waitFor(() => expect(dialog.open).toBe(true));
      await completeAnimation();
      animations.length = 0;
      if (modalDiv === null) throw new Error("Missing fixture sheet content");
      const handle = modalDiv.querySelector(
        "[aria-hidden='true']",
      ) as HTMLElement;
      handle.setPointerCapture = vi.fn();
      return { handle, dialog, onBackdropClick };
    }

    function pointer(handle: HTMLElement, type: string, clientY: number): void {
      const event = new MouseEvent(type, { bubbles: true, clientY });
      Object.defineProperty(event, "pointerId", { value: 1 });
      fireEvent(handle, event);
    }

    it("snaps a cancelled drag back without dismissing the sheet", async () => {
      const { handle, dialog, onBackdropClick } = await openSheet();
      pointer(handle, "pointerdown", 100);
      pointer(handle, "pointermove", 220);
      pointer(handle, "pointercancel", 220);

      expect(onBackdropClick).not.toHaveBeenCalled();
      expect(isModalOpen("QuoteRate")).toBe(true);
      expect(dialog.open).toBe(true);
      expect(animations.at(-1)?.params["translateY"]).toEqual(["120px", "0px"]);
    });

    it("snaps back when a dismissal callback keeps the sheet open", async () => {
      const { handle, onBackdropClick } = await openSheet();
      pointer(handle, "pointerdown", 100);
      pointer(handle, "pointermove", 220);
      pointer(handle, "pointerup", 220);

      expect(onBackdropClick).toHaveBeenCalledOnce();
      expect(isModalOpen("QuoteRate")).toBe(true);
      expect(animations.at(-1)?.params["translateY"]).toEqual(["120px", "0px"]);
    });
  });
});
