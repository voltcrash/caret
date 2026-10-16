import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  restart: vi.fn(),
  retrySavingResult: vi.fn(),
  download: vi.fn(),
  share: vi.fn(),
  copyToClipboard: vi.fn(),
  toggleReplayDisplay: vi.fn(),
  toggleResultWords: vi.fn(),
  showModal: vi.fn(),
  showNoticeNotification: vi.fn(),
}));

vi.mock("../../../../../src/features/typing/runtime/test-logic", () => ({
  restart: mocks.restart,
  retrySavingResult: mocks.retrySavingResult,
}));
vi.mock("../../../../../src/features/typing/runtime/test-screenshot", () => ({
  download: mocks.download,
  share: mocks.share,
  copyToClipboard: mocks.copyToClipboard,
}));
vi.mock("../../../../../src/features/typing/runtime/replay", () => ({
  toggleReplayDisplay: mocks.toggleReplayDisplay,
}));
vi.mock("../../../../../src/features/typing/runtime/result", () => ({
  toggleResultWords: mocks.toggleResultWords,
}));
vi.mock("../../../../../src/ts/states/modals", () => ({
  showModal: mocks.showModal,
}));
vi.mock("../../../../../src/ts/states/notifications", () => ({
  showNoticeNotification: mocks.showNoticeNotification,
}));
vi.mock("../../../../../src/ts/states/test", () => ({
  getResultVisible: () => true,
}));
vi.mock("../../../../../src/ts/states/core", async () => {
  const { createSignal } = await import("solid-js");
  const [getIsScreenshotting, setIsScreenshotting] = createSignal(false);
  return {
    getActivePage: () => "test",
    getIsScreenshotting,
    setIsScreenshotting,
  };
});

import { ResultButtons } from "../../../../../src/features/typing/components/result/ResultButtons";
import { setConfigStore } from "../../../../../src/ts/config/store";
import { setIsScreenshotting } from "../../../../../src/ts/states/core";
import { setResultState } from "../../../../../src/ts/states/result";
import { getKeyboardProxyElement } from "../../../../../src/ts/states/test-dom";

function renderButtons(): HTMLElement {
  return render(() => <ResultButtons />).container;
}

const byId = (c: HTMLElement, id: string): HTMLElement =>
  c.querySelector(`#${id}`) as HTMLElement;

describe("ResultButtons", () => {
  beforeEach(() => {
    setConfigStore("mode", "words");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    setResultState({ retrySaving: false, noStress: false });
  });

  it("renders the buttons in tab order", () => {
    const c = renderButtons();
    expect(
      [...c.querySelectorAll(".buttons button")].map((b) => [
        b.id,
        b.getAttribute("aria-label"),
      ]),
    ).toEqual([
      ["nextTestButton", "Next test"],
      ["restartTestButtonWithSameWordset", "Repeat test"],
      ["practiseWordsButton", "Practice words"],
      ["showWordHistoryButton", "Toggle words history"],
      ["watchReplayButton", "Watch replay"],
      [
        "saveScreenshotButton",
        "Copy screenshot to clipboard\n(shift click to download)",
      ],
    ]);
    expect(byId(c, "saveScreenshotButton")).toHaveAttribute(
      "data-balloon-break",
    );
  });

  it("wires the button actions", () => {
    const c = renderButtons();
    fireEvent.click(byId(c, "nextTestButton"));
    expect(mocks.restart).toHaveBeenCalledWith();
    fireEvent.click(byId(c, "restartTestButtonWithSameWordset"));
    expect(mocks.restart).toHaveBeenCalledWith({ withSameWordset: true });
    fireEvent.click(byId(c, "practiseWordsButton"));
    expect(mocks.showModal).toHaveBeenCalledWith("PractiseWords");
    fireEvent.click(byId(c, "showWordHistoryButton"));
    expect(mocks.toggleResultWords).toHaveBeenCalled();
    fireEvent.click(byId(c, "watchReplayButton"));
    expect(mocks.toggleReplayDisplay).toHaveBeenCalled();
    fireEvent.click(byId(c, "saveScreenshotButton"));
    expect(mocks.copyToClipboard).toHaveBeenCalled();
    fireEvent.click(byId(c, "saveScreenshotButton"), { shiftKey: true });
    expect(mocks.download).toHaveBeenCalled();
  });

  it("blocks repeat and practice in zen mode", () => {
    setConfigStore("mode", "zen");
    const c = renderButtons();
    fireEvent.click(byId(c, "restartTestButtonWithSameWordset"));
    fireEvent.click(byId(c, "practiseWordsButton"));
    expect(mocks.restart).not.toHaveBeenCalled();
    expect(mocks.showModal).not.toHaveBeenCalled();
    expect(mocks.showNoticeNotification).toHaveBeenCalledTimes(2);
  });

  it("hides history, replay and screenshot in glarses mode", () => {
    const c = renderButtons();
    setResultState("noStress", true);
    const hidden = [...c.querySelectorAll(".buttons button.hidden")].map(
      (b) => b.id,
    );
    expect(hidden).toEqual([
      "showWordHistoryButton",
      "watchReplayButton",
      "saveScreenshotButton",
    ]);
  });

  it("shows the download icon while shift is held", () => {
    const c = renderButtons();
    const icon = (): Element | null =>
      byId(c, "saveScreenshotButton").querySelector("i");
    expect(icon()).toHaveClass("far", "fa-image");
    fireEvent.keyDown(document, { key: "Shift" });
    expect(icon()).toHaveClass("fas", "fa-download");
    fireEvent.keyUp(document, { key: "Shift" });
    expect(icon()).toHaveClass("far", "fa-image");
  });

  it("hides the buttons while screenshotting", () => {
    const c = renderButtons();
    expect(c.querySelector(".buttons")).not.toHaveClass("hidden");
    setIsScreenshotting(true);
    expect(c.querySelector(".buttons")).toHaveClass("hidden");
    setIsScreenshotting(false);
  });

  it("shows retry saving from the store", () => {
    const c = renderButtons();
    expect(byId(c, "retrySavingResultButton")).toBeNull();
    setResultState("retrySaving", true);
    fireEvent.click(byId(c, "retrySavingResultButton"));
    expect(mocks.retrySavingResult).toHaveBeenCalled();
  });

  it("focuses the keyboard proxy during next and repeat taps on touch", () => {
    vi.mocked(window.matchMedia).mockImplementation((query) =>
      Object.assign(new EventTarget(), {
        matches: query === "(pointer: coarse)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    );
    const focus = vi.spyOn(getKeyboardProxyElement(), "focus");
    const c = renderButtons();
    mocks.restart.mockImplementationOnce(() =>
      expect(focus).toHaveBeenCalledOnce(),
    );
    fireEvent.click(byId(c, "nextTestButton"));
    mocks.restart.mockImplementationOnce(() =>
      expect(focus).toHaveBeenCalledTimes(2),
    );
    fireEvent.click(byId(c, "restartTestButtonWithSameWordset"));

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(mocks.restart).toHaveBeenCalledTimes(2);
  });

  it("uses native sharing on touch and preserves shift-download", () => {
    vi.mocked(window.matchMedia).mockImplementation((query) =>
      Object.assign(new EventTarget(), {
        matches: query === "(pointer: coarse)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    );
    const c = renderButtons();
    const button = byId(c, "saveScreenshotButton");
    expect(button).toHaveAttribute("aria-label", "Share screenshot");
    fireEvent.click(button);
    expect(mocks.share).toHaveBeenCalledOnce();
    expect(mocks.copyToClipboard).not.toHaveBeenCalled();
    fireEvent.click(button, { shiftKey: true });
    expect(mocks.download).toHaveBeenCalledOnce();
    expect(mocks.share).toHaveBeenCalledOnce();
  });
});
