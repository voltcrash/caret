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
});
