import { createRoot, createSignal } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

const anime = vi.hoisted(() => ({
  animate: vi.fn(() => ({ pause: vi.fn() })),
}));
vi.mock("animejs", async (original) => ({
  ...(await original<typeof import("animejs")>()),
  animate: anime.animate,
}));

import { useVisibilityAnimation } from "../../src/ts/hooks/useVisibilityAnimation";

describe("useVisibilityAnimation", () => {
  it("animates only when visibility changes", () => {
    const element = document.createElement("div");
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
    expect(anime.animate).toHaveBeenCalledTimes(1);

    // A fresh but equal state, like hiding an already hidden loader bar.
    setState({ visible: false });
    setState({ visible: false });
    expect(anime.animate).toHaveBeenCalledTimes(1);

    setState({ visible: true });
    expect(anime.animate).toHaveBeenCalledTimes(2);
    expect(anime.animate).toHaveBeenLastCalledWith(
      element,
      expect.objectContaining({ opacity: 1 }),
    );
    dispose();
  });
});
