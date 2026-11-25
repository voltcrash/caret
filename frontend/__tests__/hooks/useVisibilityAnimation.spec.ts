import { createRoot, createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { useVisibilityAnimation } from "../../src/ts/hooks/useVisibilityAnimation";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useVisibilityAnimation", () => {
  it("animates only when visibility changes", () => {
    const element = document.createElement("div");
    document.body.append(element);
    const animateSpy = vi.spyOn(element, "animate");
    const [state, setState] = createSignal<{ visible: boolean }>({
      visible: false,
    });
    const dispose = createRoot((dispose) => {
      useVisibilityAnimation({
        element: () => element,
        isVisible: () => state().visible,
      });
      return dispose;
    });
    expect(animateSpy).toHaveBeenCalledTimes(1);

    // A fresh but equal state, like hiding an already hidden loader bar.
    setState({ visible: false });
    setState({ visible: false });
    expect(animateSpy).toHaveBeenCalledTimes(1);

    setState({ visible: true });
    expect(animateSpy).toHaveBeenCalledTimes(2);
    expect(element.style.opacity).toBe("1");
    expect(element.className).not.toContain("hidden");
    dispose();
    element.remove();
  });

  it("commits in-flight opacity when visibility reverses mid-animation", () => {
    const element = document.createElement("div");
    document.body.append(element);
    const [visible, setVisible] = createSignal(true);
    const dispose = createRoot((dispose) => {
      useVisibilityAnimation({
        element: () => element,
        isVisible: visible,
        showAnimationOptions: { duration: 100 },
        hideAnimationOptions: { duration: 100 },
      });
      return dispose;
    });

    element.getAnimations().forEach((anim) => anim.finish());

    setVisible(false);
    const hideAnim = element.getAnimations()[0];
    expect(hideAnim).toBeDefined();
    if (hideAnim) hideAnim.currentTime = 50;

    setVisible(true);
    const showAnim = element.getAnimations()[0];
    expect(showAnim).toBeDefined();
    const effect = showAnim?.effect as KeyframeEffect;
    const fromOpacity = Number(effect.getKeyframes()[0]?.["opacity"]);
    expect(fromOpacity).toBeGreaterThan(0);
    expect(fromOpacity).toBeLessThan(1);

    dispose();
    expect(element.getAnimations()).toHaveLength(0);
    element.remove();
  });
});
