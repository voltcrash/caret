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
});
