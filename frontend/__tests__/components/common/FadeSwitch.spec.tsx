import { cleanup, render, screen } from "@solidjs/testing-library";
import { createSignal, Show } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { FadeSwitch } from "../../../src/ts/components/common/FadeSwitch";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("FadeSwitch", () => {
  it("fades out the current view before swapping to the next", async () => {
    const [tab, setTab] = createSignal<"a" | "b">("a");
    const { container } = render(() => (
      <FadeSwitch value={tab()} class="switch-box">
        {(current) => (
          <Show
            when={current() === "a"}
            fallback={<div data-testid="view-b">B</div>}
          >
            <div data-testid="view-a">A</div>
          </Show>
        )}
      </FadeSwitch>
    ));

    const wrapper = container.querySelector(".switch-box") as HTMLElement;
    expect(screen.getByTestId("view-a")).toBeInTheDocument();

    setTab("b");
    const exitAnim = wrapper.getAnimations()[0];
    expect(exitAnim).toBeDefined();
    expect(screen.getByTestId("view-a")).toBeInTheDocument();

    exitAnim?.finish();
    await exitAnim?.finished;
    await Promise.resolve();

    expect(screen.queryByTestId("view-a")).not.toBeInTheDocument();
    expect(screen.getByTestId("view-b")).toBeInTheDocument();
    const enterAnim = wrapper.getAnimations()[0];
    expect(enterAnim).toBeDefined();
    enterAnim?.finish();
  });

  it("swaps immediately when reduced motion is preferred", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const [tab, setTab] = createSignal<"a" | "b">("a");
    render(() => (
      <FadeSwitch value={tab()}>
        {(current) => (
          <Show
            when={current() === "a"}
            fallback={<div data-testid="view-b">B</div>}
          >
            <div data-testid="view-a">A</div>
          </Show>
        )}
      </FadeSwitch>
    ));

    setTab("b");
    expect(screen.queryByTestId("view-a")).not.toBeInTheDocument();
    expect(screen.getByTestId("view-b")).toBeInTheDocument();
  });

  it("cancels a pending exit and fades back in when value reverts mid-exit", async () => {
    const [tab, setTab] = createSignal<"a" | "b">("a");
    const { container } = render(() => (
      <FadeSwitch value={tab()} class="switch-box">
        {(current) => (
          <Show
            when={current() === "a"}
            fallback={<div data-testid="view-b">B</div>}
          >
            <div data-testid="view-a">A</div>
          </Show>
        )}
      </FadeSwitch>
    ));

    const wrapper = container.querySelector(".switch-box") as HTMLElement;
    setTab("b");
    const exitAnim = wrapper.getAnimations()[0];
    expect(exitAnim).toBeDefined();
    const exitFinished = exitAnim?.finished;
    if (exitAnim) exitAnim.currentTime = 60;

    setTab("a");
    await exitFinished?.catch(() => undefined);
    await Promise.resolve();

    expect(screen.getByTestId("view-a")).toBeInTheDocument();
    expect(screen.queryByTestId("view-b")).not.toBeInTheDocument();
    expect(wrapper.style.opacity).toBe("1");

    const reenterAnim = wrapper.getAnimations()[0];
    expect(reenterAnim).toBeDefined();
    const effect = reenterAnim?.effect as KeyframeEffect;
    const fromOpacity = Number(effect.getKeyframes()[0]?.["opacity"]);
    expect(fromOpacity).toBeGreaterThan(0);
    expect(fromOpacity).toBeLessThan(1);
    reenterAnim?.finish();
  });
});
