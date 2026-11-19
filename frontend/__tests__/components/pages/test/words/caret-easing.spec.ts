import { describe, expect, it } from "vite-plus/test";

import {
  caretGlideEasing,
  cubicBezier,
  linearEasing,
} from "../../../../../src/features/typing/components/words/caret-easing";

describe("caret easing", () => {
  it("serializes as a CSS timing function", () => {
    expect(cubicBezier(0.25, 0.1, 0.25, 1).css).toBe(
      "cubic-bezier(0.25, 0.1, 0.25, 1)",
    );
    expect(linearEasing.css).toBe("linear");
    expect(
      CSS.supports("transition-timing-function", caretGlideEasing.css),
    ).toBe(true);
  });

  it("pins the endpoints and stays monotonic", () => {
    const ease = cubicBezier(0.42, 0, 0.58, 1);
    expect(ease.at(-1)).toBe(0);
    expect(ease.at(0)).toBe(0);
    expect(ease.at(1)).toBe(1);
    expect(ease.at(2)).toBe(1);
    let previous = 0;
    for (let i = 1; i <= 100; i++) {
      const value = ease.at(i / 100);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("leaves at once and settles onto the letter", () => {
    // Already moving on the first frame, then a soft landing.
    expect(caretGlideEasing.at(0.1)).toBeGreaterThan(0.15);
    expect(caretGlideEasing.at(0.5)).toBeGreaterThan(0.7);
    expect(1 - caretGlideEasing.at(0.9)).toBeLessThan(0.02);
  });

  it("matches a browser's own sampling of the curve", () => {
    const ease = cubicBezier(0.25, 0.46, 0.45, 0.94);
    const element = document.createElement("div");
    document.body.append(element);
    const animation = element.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 1000,
      easing: ease.css,
    });
    animation.pause();
    try {
      for (const time of [100, 250, 500, 750, 900]) {
        animation.currentTime = time;
        const opacity = Number(getComputedStyle(element).opacity);
        expect(Math.abs(opacity - ease.at(time / 1000))).toBeLessThan(0.002);
      }
    } finally {
      animation.cancel();
      element.remove();
    }
  });
});
