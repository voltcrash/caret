import { cleanup, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

type Target = { width: string; duration: number; ease?: string };

const live = vi.hoisted(() => ({
  target: undefined as unknown as () => Target,
  setTarget: undefined as unknown as (target: Target) => void,
  shown: undefined as unknown as () => boolean,
  setShown: undefined as unknown as (shown: boolean) => void,
}));
vi.mock("../../../../../src/ts/states/live-stats", () => ({
  getBarTarget: () => live.target(),
  showLiveStats: () => live.shown(),
}));

import { BarTimerProgress } from "../../../../../src/features/typing/components/live-stats/BarTimerProgress";
import { setConfigStore } from "../../../../../src/ts/config/store";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount(timerStyle: "bar" | "mini"): HTMLElement {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  setConfigStore("mode", "time");
  setConfigStore("timerStyle", timerStyle);
  const [target, setTarget] = createSignal<Target>({
    width: "100vw",
    duration: 0,
  });
  const [shown, setShown] = createSignal(false);
  Object.assign(live, { target, setTarget, shown, setShown });
  const { container } = render(() => <BarTimerProgress />);
  const bar = container.querySelector(".fixed");
  if (!(bar instanceof HTMLElement)) throw new Error("Missing timer bar");
  return bar;
}

describe("BarTimerProgress", () => {
  it("does not animate while the bar is hidden", () => {
    const bar = mount("mini");
    live.setShown(true);
    live.setTarget({ width: "50vw", duration: 1000, ease: "linear" });
    expect(bar.style.scale).toBe("0.5 1");
    expect(bar.getAnimations()).toHaveLength(0);
  });

  it("keeps filling a bar that hides as the test finishes", () => {
    const bar = mount("bar");
    live.setShown(true);
    live.setTarget({ width: "90vw", duration: 0 });
    live.setShown(false);
    live.setTarget({ width: "100vw", duration: 125 });
    expect(bar.getAnimations()).toHaveLength(1);
    live.setTarget({ width: "0vw", duration: 0 });
    expect(bar.getAnimations()).toHaveLength(0);
  });

  it("scales the shown bar on the compositor instead of resizing it", () => {
    const bar = mount("bar");
    live.setShown(true);
    live.setTarget({ width: "75vw", duration: 1000, ease: "linear" });
    expect(bar.style.width).toBe("");
    expect(bar.style.scale).toBe("0.75 1");
    const [animation] = bar.getAnimations();
    const effect = animation?.effect as KeyframeEffect;
    expect(effect.getTiming()).toMatchObject({
      duration: 1000,
      easing: "linear",
    });
    // `1 1` is the bar's full width, which serializes as `1`.
    expect(effect.getKeyframes().map((frame) => frame["scale"])).toEqual([
      "1",
      "0.75 1",
    ]);

    // The next second continues from where the bar is drawn.
    animation?.pause();
    if (animation) animation.currentTime = 500;
    live.setTarget({ width: "50vw", duration: 1000, ease: "linear" });
    expect(animation?.playState).toBe("idle");
    const [next] = bar.getAnimations();
    const [from] = (next?.effect as KeyframeEffect)
      .getKeyframes()
      .map((frame) => frame["scale"]);
    expect(parseFloat(String(from))).toBeCloseTo(0.875, 2);
  });
});
