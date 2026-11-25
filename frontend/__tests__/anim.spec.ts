import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { animateAsync } from "../src/ts/anim";

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("animateAsync", () => {
  it("anchors startTime to the timeline so fade-out does not stall pending", async () => {
    const element = document.createElement("div");
    element.style.opacity = "1";
    document.body.append(element);

    const onBegin = vi.fn();
    const onComplete = vi.fn();

    const pending = animateAsync(element, {
      opacity: 0,
      duration: 125,
      onBegin,
      onComplete,
    });

    expect(onBegin).toHaveBeenCalledTimes(1);
    expect(element.style.opacity).toBe("0");

    const animation = element.getAnimations()[0];
    expect(animation).toBeDefined();
    expect(animation?.pending).toBe(false);
    expect(typeof animation?.startTime).toBe("number");

    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    expect(parseFloat(getComputedStyle(element).opacity)).toBeLessThan(1);

    animation?.finish();
    await pending;

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(getComputedStyle(element).opacity).toBe("0");
  });

  it("cancels an in-flight animation and only completes the superseding one", async () => {
    const element = document.createElement("div");
    element.style.opacity = "1";
    document.body.append(element);

    const firstComplete = vi.fn();
    const secondComplete = vi.fn();

    const first = animateAsync(element, {
      opacity: 0,
      duration: 100,
      onComplete: firstComplete,
    });
    const firstAnim = element.getAnimations()[0];
    expect(firstAnim).toBeDefined();
    if (firstAnim) firstAnim.currentTime = 50;

    const second = animateAsync(element, {
      opacity: 1,
      duration: 100,
      onComplete: secondComplete,
    });
    const secondAnim = element.getAnimations()[0];
    expect(firstAnim?.playState).toBe("idle");
    expect(secondAnim).toBeDefined();

    const effect = secondAnim?.effect as KeyframeEffect;
    const fromOpacity = Number(effect.getKeyframes()[0]?.["opacity"]);
    expect(fromOpacity).toBeGreaterThan(0);
    expect(fromOpacity).toBeLessThan(1);

    secondAnim?.finish();
    await Promise.all([first, second]);

    expect(firstComplete).not.toHaveBeenCalled();
    expect(secondComplete).toHaveBeenCalledTimes(1);
    expect(element.style.opacity).toBe("1");
  });

  it("completes immediately without animating when reduced motion is preferred", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const element = document.createElement("div");
    element.style.opacity = "1";
    document.body.append(element);

    const onComplete = vi.fn();
    await animateAsync(element, {
      opacity: 0,
      duration: 125,
      onComplete,
    });

    expect(element.getAnimations()).toHaveLength(0);
    expect(element.style.opacity).toBe("0");
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
