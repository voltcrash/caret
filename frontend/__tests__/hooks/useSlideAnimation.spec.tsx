import { render, cleanup } from "@solidjs/testing-library";
import { AnimationParams } from "animejs";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  animate: vi.fn((_el: HTMLElement, _options: unknown) => ({
    cancel: vi.fn(),
  })),
}));
vi.mock("animejs", async (original) => ({
  ...(await original<typeof import("animejs")>()),
  animate: mocks.animate,
}));

import { useSlideAnimation } from "../../src/ts/hooks/useSlideAnimation";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useSlideAnimation", () => {
  it("preserves layout classes and the legacy expansion/collapse cleanup", () => {
    const [visible, setVisible] = createSignal(false);
    let element: HTMLDivElement | undefined;
    render(() => {
      useSlideAnimation({
        element: () => element,
        visible,
        duration: () => 125,
      });
      return (
        <div
          ref={(el) => {
            element = el;
          }}
          class="flex hidden"
          style={{ "padding-top": "8px" }}
        />
      );
    });
    expect(mocks.animate).not.toHaveBeenCalled();
    setVisible(true);
    expect(element).toHaveClass("flex");
    expect(element).not.toHaveClass("hidden");
    let options = mocks.animate.mock.calls[0]?.[1] as AnimationParams;
    options.onComplete?.({} as never);
    expect(element?.style.height).toBe("");
    expect(element?.style.overflow).toBe("");
    setVisible(false);
    options = mocks.animate.mock.calls[1]?.[1] as AnimationParams;
    options.onComplete?.({} as never);
    expect(element).toHaveClass("flex", "hidden");
    expect(element?.style.paddingTop).toBe("");
  });

  it("hides instantly at zero duration and cancels animation on disposal", () => {
    const [visible, setVisible] = createSignal(false);
    let element: HTMLDivElement | undefined;
    const { unmount } = render(() => {
      useSlideAnimation({ element: () => element, visible, duration: () => 0 });
      return (
        <div
          ref={(el) => {
            element = el;
          }}
          class="grid hidden"
        />
      );
    });
    setVisible(true);
    const animation = mocks.animate.mock.results[0]?.value;
    setVisible(false);
    expect(element).toHaveClass("grid", "hidden");
    expect(mocks.animate).toHaveBeenCalledTimes(1);
    unmount();
    expect(animation?.cancel).toHaveBeenCalledOnce();
  });
});
