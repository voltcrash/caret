import { render, cleanup } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { useSlideAnimation } from "../../src/ts/hooks/useSlideAnimation";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useSlideAnimation", () => {
  it("preserves layout classes and the legacy expansion/collapse cleanup", async () => {
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
    expect(element?.getAnimations()).toHaveLength(0);

    setVisible(true);
    expect(element).toHaveClass("flex");
    expect(element).not.toHaveClass("hidden");
    const openAnim = element?.getAnimations()[0];
    expect(openAnim).toBeDefined();
    openAnim?.finish();
    await openAnim?.finished;
    await Promise.resolve();
    expect(element?.style.height).toBe("");
    expect(element?.style.overflow).toBe("");

    setVisible(false);
    const closeAnim = element?.getAnimations()[0];
    expect(closeAnim).toBeDefined();
    closeAnim?.finish();
    await closeAnim?.finished;
    await Promise.resolve();
    expect(element).toHaveClass("flex", "hidden");
    expect(element?.style.paddingTop).toBe("");
  });

  it("hides instantly at zero duration and cancels animation on disposal", () => {
    const [visible, setVisible] = createSignal(false);
    const [duration, setDuration] = createSignal(0);
    let element: HTMLDivElement | undefined;
    const { unmount } = render(() => {
      useSlideAnimation({ element: () => element, visible, duration });
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
    expect(element).toHaveClass("grid");
    expect(element).not.toHaveClass("hidden");
    expect(element?.getAnimations()).toHaveLength(0);

    setVisible(false);
    expect(element).toHaveClass("grid", "hidden");
    expect(element?.getAnimations()).toHaveLength(0);

    setDuration(125);
    setVisible(true);
    const running = element?.getAnimations()[0];
    expect(running).toBeDefined();
    unmount();
    expect(running?.playState).toBe("idle");
  });
});
