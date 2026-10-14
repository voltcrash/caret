import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { reduceMotionParams } from "../../src/ts/utils/motion";
const state = vi.hoisted(() => ({ reduced: false }));
vi.mock("../../src/ts/utils/misc", () => ({
  applyReducedMotion: (duration: number) => (state.reduced ? 0 : duration),
}));
afterEach(() => {
  state.reduced = false;
});
describe("reduced motion parameters", () => {
  it("preserves normal animation timing and identity", () => {
    const params = { opacity: 1, duration: 300, delay: 100, loop: true };
    expect(reduceMotionParams(params)).toBe(params);
  });

  it("removes default duration, delays and loops under reduced motion", () => {
    state.reduced = true;
    expect(reduceMotionParams({ opacity: 1, delay: 200, loop: true })).toEqual({
      opacity: 1,
      duration: 0,
      delay: 0,
      loop: false,
    });
  });

  it("replaces callback timing while retaining completion handlers", () => {
    state.reduced = true;
    const onComplete = vi.fn();
    expect(
      reduceMotionParams({ duration: () => 300, delay: () => 100, onComplete }),
    ).toEqual({ duration: 0, delay: 0, loop: false, onComplete });
  });
});
