import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("../../../../../src/ts/anim", () => ({ animateAsync: vi.fn() }));
vi.mock("../../../../../src/ts/states/notifications", () => ({
  showErrorNotification: vi.fn(),
}));

import {
  showResultScreen,
  useResultScreen,
} from "../../../../../src/features/typing/components/result/useResultScreen";
import {
  createCroppedScreenshot,
  useScreenshotCanvas,
} from "../../../../../src/features/typing/components/result/useScreenshotCanvas";
import { setIsScreenshotting } from "../../../../../src/ts/states/core";
import { showErrorNotification } from "../../../../../src/ts/states/notifications";

afterEach(() => {
  cleanup();
  setIsScreenshotting(false);
  vi.restoreAllMocks();
});

describe("result lifecycle", () => {
  it("reveals, focuses and scrolls the owned result, preserving screenshot classes", async () => {
    const node = document.createElement("div");
    node.className = "hidden existing";
    node.tabIndex = -1;
    const scroll = vi.fn();
    node.scrollIntoView = scroll;
    document.body.append(node);
    const { unmount } = render(() => {
      useResultScreen(() => node);
      return null;
    });
    setIsScreenshotting(true);
    await showResultScreen(125);
    expect(node).toHaveClass("existing", "noBalloons");
    expect(node).not.toHaveClass("hidden");
    expect(document.activeElement).toBe(node);
    expect(scroll).toHaveBeenLastCalledWith({ block: "center" });
    Object.defineProperty(node, "offsetHeight", {
      value: window.innerHeight + 1,
    });
    await showResultScreen(0);
    expect(scroll).toHaveBeenLastCalledWith({ block: "start" });
    setIsScreenshotting(false);
    expect(node).not.toHaveClass("noBalloons");
    unmount();
    await showResultScreen(0);
    expect(scroll).toHaveBeenCalledTimes(2);
    node.remove();
  });

  it("crops into a canvas with the supplied pixel dimensions and releases its factory", () => {
    const drawImage = vi.fn();
    const context = {
      drawImage,
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    const { unmount } = render(() => {
      useScreenshotCanvas();
      return null;
    });
    const source = document.createElement("canvas");
    const crop = {
      source,
      width: 600,
      height: 300,
      x: 40,
      y: 80,
      cropWidth: 599,
      cropHeight: 299,
    };
    const canvas = createCroppedScreenshot(crop);
    expect(canvas?.width).toBe(600);
    expect(canvas?.height).toBe(300);
    expect(drawImage).toHaveBeenCalledWith(
      source,
      40,
      80,
      599,
      299,
      0,
      0,
      600,
      300,
    );
    expect(context.imageSmoothingEnabled).toBe(true);
    expect(context.imageSmoothingQuality).toBe("high");
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    expect(createCroppedScreenshot(crop)).toBeNull();
    expect(showErrorNotification).toHaveBeenCalledWith(
      "Failed to get canvas context for screenshot",
    );
    unmount();
    expect(() => createCroppedScreenshot(crop)).toThrow(
      "Result canvas is not mounted",
    );
  });
});
