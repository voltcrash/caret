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
});
