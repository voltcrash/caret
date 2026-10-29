import { afterEach, expect, it, vi } from "vite-plus/test";
import { showConfetti } from "../../src/features/typing/runtime/result/confetti";
import * as SlowTimer from "../../src/ts/states/slow-timer";

afterEach(() => {
  SlowTimer.clear();
  vi.restoreAllMocks();
  document.body.style.removeProperty("--main-color");
  document.body.style.removeProperty("--text-color");
  document.body.style.removeProperty("--sub-color");
});

it("renders visible particles without a blob worker blocked by the site CSP", async () => {
  document.body.style.setProperty("--main-color", "#4ea8ff");
  document.body.style.setProperty("--text-color", "#e4ebff");
  document.body.style.setProperty("--sub-color", "#8290b4");
  const worker = vi.spyOn(window, "Worker");
  await showConfetti();
  expect(worker).not.toHaveBeenCalled();
  await expect
    .poll(() => {
      const canvas = document.querySelector("body > canvas");
      if (!(canvas instanceof HTMLCanvasElement)) return false;
      const context = canvas.getContext("2d");
      if (context === null) return false;
      return context
        .getImageData(0, 0, canvas.width, canvas.height)
        .data.some((value, index) => index % 4 === 3 && value > 0);
    })
    .toBe(true);
  await expect
    .poll(() => document.querySelector("body > canvas"), {
      timeout: 5000,
    })
    .toBeNull();
});
