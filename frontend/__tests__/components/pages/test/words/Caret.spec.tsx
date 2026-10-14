import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import type { CaretController } from "../../../../../src/ts/components/pages/test/words/caret-controller";

const bindings = vi.hoisted(() => ({
  main: undefined as CaretController | undefined,
  pace: undefined as CaretController | undefined,
  unregisterMain: vi.fn(),
  unregisterPace: vi.fn(),
  cancelFrame: vi.fn(),
}));
vi.mock("../../../../../src/ts/test/caret", () => ({
  setCaret: (controller: CaretController) => {
    bindings.main = controller;
    return bindings.unregisterMain;
  },
}));
vi.mock("../../../../../src/ts/test/pace-caret", () => ({
  setCaret: (controller: CaretController) => {
    bindings.pace = controller;
    return bindings.unregisterPace;
  },
}));
vi.mock("../../../../../src/ts/test/test-words", () => ({
  words: { get: () => undefined },
}));
vi.mock("../../../../../src/ts/utils/debounced-animation-frame", () => ({
  cancelPendingAnimationFrame: bindings.cancelFrame,
  requestDebouncedAnimationFrame: vi.fn(),
}));
import { Caret } from "../../../../../src/ts/components/pages/test/words/Caret";
import { Config } from "../../../../../src/ts/config/store";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Caret ownership", () => {
  it("creates a controller per node and disposes it on unmount", () => {
    Config.caretStyle = "block";
    Config.paceCaretStyle = "underline";
    const mainRef = vi.fn();
    const paceRef = vi.fn();
    const { container, unmount } = render(() => (
      <>
        <Caret ref={mainRef} />
        <Caret pace ref={paceRef} />
      </>
    ));
    const main = container.querySelector("#caret");
    const pace = container.querySelector("#paceCaret");
    expect(mainRef).toHaveBeenCalledWith(main);
    expect(paceRef).toHaveBeenCalledWith(pace);
    expect(main).toHaveClass("block");
    expect(pace).toHaveClass("underline", "hidden");
    expect(bindings.main?.isFullWidth()).toBe(true);
    expect(bindings.pace?.isHidden()).toBe(true);

    const stopMain = vi.spyOn(
      bindings.main as CaretController,
      "stopAllAnimations",
    );
    unmount();
    expect(stopMain).toHaveBeenCalledOnce();
    expect(bindings.cancelFrame).toHaveBeenCalledWith("caret.caret.goTo");
    expect(bindings.cancelFrame).toHaveBeenCalledWith("caret.paceCaret.goTo");
    expect(bindings.unregisterMain).toHaveBeenCalledOnce();
    expect(bindings.unregisterPace).toHaveBeenCalledOnce();
  });
});
