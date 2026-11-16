import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { applyReducedMotion } from "../../src/ts/utils/misc";

afterEach(() => vi.unstubAllGlobals());

describe("applyReducedMotion", () => {
  it("parses the media query once and follows live preference changes", () => {
    const list = { matches: false };
    const matchMedia = vi.fn(() => list);
    vi.stubGlobal("matchMedia", matchMedia);
    expect(applyReducedMotion(125)).toBe(125);
    list.matches = true;
    expect(applyReducedMotion(125)).toBe(0);
    expect(applyReducedMotion(85)).toBe(0);
    expect(matchMedia).toHaveBeenCalledTimes(1);
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion)");
  });

  it("uses a replaced matchMedia implementation", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    expect(applyReducedMotion(100)).toBe(0);
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(applyReducedMotion(100)).toBe(100);
  });

  it("keeps animations when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(applyReducedMotion(100)).toBe(100);
  });
});
