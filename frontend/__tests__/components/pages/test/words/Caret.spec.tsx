import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import type { CaretController } from "../../../../../src/features/typing/components/words/caret-controller";

const bindings = vi.hoisted(() => ({
  main: undefined as CaretController | undefined,
  pace: undefined as CaretController | undefined,
  unregisterMain: vi.fn(),
  unregisterPace: vi.fn(),
  cancelFrame: vi.fn(),
  updatePosition: vi.fn(),
}));
vi.mock("../../../../../src/features/typing/runtime/caret", () => ({
  setCaret: (controller: CaretController) => {
    bindings.main = controller;
    return bindings.unregisterMain;
  },
  updatePosition: bindings.updatePosition,
}));
vi.mock("../../../../../src/ts/states/test-dom", () => ({
  areTestElementsMounted: () => true,
}));
vi.mock("../../../../../src/features/typing/runtime/pace-caret", () => ({
  setCaret: (controller: CaretController) => {
    bindings.pace = controller;
    return bindings.unregisterPace;
  },
}));
vi.mock("../../../../../src/features/typing/runtime/test-words", () => ({
  words: { get: () => undefined },
}));
vi.mock("../../../../../src/ts/utils/debounced-animation-frame", () => ({
  cancelPendingAnimationFrame: bindings.cancelFrame,
  requestDebouncedAnimationFrame: vi.fn(),
}));
import { Caret } from "../../../../../src/features/typing/components/words/Caret";
import { getMutableConfig } from "../../../../../src/ts/config/store";
import { configEvent } from "../../../../../src/ts/events/config";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Caret ownership", () => {
  it("creates a controller per node and disposes it on unmount", () => {
    getMutableConfig().caretStyle = "block";
    getMutableConfig().paceCaretStyle = "underline";
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

  it("applies style and smooth caret changes until unmounted", () => {
    getMutableConfig().caretStyle = "default";
    getMutableConfig().paceCaretStyle = "default";
    const { container, unmount } = render(() => (
      <>
        <Caret ref={vi.fn()} />
        <Caret pace ref={vi.fn()} />
      </>
    ));
    const main = container.querySelector("#caret") as HTMLElement;
    const pace = container.querySelector("#paceCaret") as HTMLElement;
    const dispatch = (key: string): void =>
      configEvent.dispatch({ key } as Parameters<
        typeof configEvent.dispatch
      >[0]);

    getMutableConfig().caretStyle = "outline";
    dispatch("caretStyle");
    expect(main).toHaveClass("outline");
    expect(pace).toHaveClass("default");
    expect(bindings.updatePosition).toHaveBeenCalledWith(true);

    getMutableConfig().paceCaretStyle = "block";
    dispatch("paceCaretStyle");
    expect(pace).toHaveClass("block");
    expect(main).toHaveClass("outline");

    getMutableConfig().smoothCaret = "off";
    dispatch("smoothCaret");
    expect(main.style.animationName.toLowerCase()).toBe("caretflashhard");
    expect(pace.style.animationName).toBe("");

    unmount();
    getMutableConfig().caretStyle = "underline";
    dispatch("caretStyle");
    expect(main).toHaveClass("outline");
  });
});
