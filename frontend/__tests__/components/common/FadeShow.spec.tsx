import { cleanup, render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { FadeShow } from "../../../src/ts/components/common/FadeShow";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("FadeShow", () => {
  it("mounts and fades in when visible, then fades out before unmounting", async () => {
    const [visible, setVisible] = createSignal(true);
    const { container } = render(() => (
      <FadeShow when={visible()} class="fade-box">
        <div data-testid="content">hello</div>
      </FadeShow>
    ));

    const wrapper = container.querySelector(".fade-box") as HTMLElement;
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(wrapper.getAnimations()).toHaveLength(1);
    wrapper.getAnimations()[0]?.finish();

    setVisible(false);
    const exitAnim = wrapper.getAnimations()[0];
    expect(exitAnim).toBeDefined();
    expect(screen.getByTestId("content")).toBeInTheDocument();
    exitAnim?.finish();
    await exitAnim?.finished;
    await Promise.resolve();
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();

    setVisible(true);
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("cancels exit when reopened mid-transition", () => {
    const [visible, setVisible] = createSignal(true);
    const { container } = render(() => (
      <FadeShow when={visible()} class="fade-box">
        <div data-testid="content">hello</div>
      </FadeShow>
    ));

    const wrapper = container.querySelector(".fade-box") as HTMLElement;
    wrapper.getAnimations()[0]?.finish();

    setVisible(false);
    const exitAnim = wrapper.getAnimations()[0];
    expect(exitAnim).toBeDefined();

    setVisible(true);
    expect(exitAnim?.playState).toBe("idle");
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(wrapper.style.opacity).toBe("1");
  });

  it("animates grid-template-rows in slide mode without forced height reads", async () => {
    const [visible, setVisible] = createSignal(false);
    const { container } = render(() => (
      <FadeShow when={visible()} slide duration={200} class="slide-box">
        <div data-testid="slide-content">slide</div>
      </FadeShow>
    ));

    expect(screen.queryByTestId("slide-content")).not.toBeInTheDocument();

    setVisible(true);
    const wrapper = container.querySelector(".slide-box") as HTMLElement;
    const inner = wrapper.firstElementChild as HTMLElement;
    expect(screen.getByTestId("slide-content")).toBeInTheDocument();
    expect(inner.style.overflow).toBe("hidden");
    const enterAnim = wrapper.getAnimations()[0];
    expect(
      (enterAnim?.effect as KeyframeEffect)
        .getKeyframes()
        .map((f) => f["gridTemplateRows"]),
    ).toEqual(["0fr", "1fr"]);
    enterAnim?.finish();
    await enterAnim?.finished;
    await Promise.resolve();
    expect(inner.style.overflow).toBe("");

    setVisible(false);
    const exitAnim = wrapper.getAnimations()[0];
    expect(inner.style.overflow).toBe("hidden");
    exitAnim?.finish();
    await exitAnim?.finished;
    await Promise.resolve();
    expect(screen.queryByTestId("slide-content")).not.toBeInTheDocument();
  });

  it("unmounts immediately when reduced motion is preferred", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const [visible, setVisible] = createSignal(true);
    const { container } = render(() => (
      <FadeShow when={visible()} class="fade-box">
        <div data-testid="content">hello</div>
      </FadeShow>
    ));

    const wrapper = container.querySelector(".fade-box") as HTMLElement;
    expect(wrapper.getAnimations()).toHaveLength(0);
    setVisible(false);
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });
});
