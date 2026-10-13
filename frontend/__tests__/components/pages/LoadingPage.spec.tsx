import { cleanup, render } from "@solidjs/testing-library";
import { AnimationParams } from "animejs";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const { mockAnimate, motion } = vi.hoisted(() => ({
  motion: { reduced: false },
  mockAnimate: vi.fn((_el: HTMLElement, params: AnimationParams) => {
    // @ts-expect-error onComplete args not needed in test
    params.onComplete?.();
    return { cancel: vi.fn() };
  }),
}));

vi.mock("animejs", () => ({
  animate: mockAnimate,
}));
vi.mock("../../../src/ts/utils/misc", () => ({
  applyReducedMotion: (duration: number) => (motion.reduced ? 0 : duration),
}));

import { LoadingPage } from "../../../src/ts/components/pages/LoadingPage";
import * as LoadingPageState from "../../../src/ts/states/loading-page";

describe("LoadingPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    motion.reduced = false;
    LoadingPageState.showSpinner();
  });

  function renderPage(): Record<"loader" | "error" | "text", HTMLElement> {
    const { container } = render(() => <LoadingPage />);
    const children = (container.firstElementChild as HTMLElement)
      .children as HTMLCollectionOf<HTMLElement>;
    return {
      loader: children[0] as HTMLElement,
      error: children[1] as HTMLElement,
      text: children[2] as HTMLElement,
    };
  }

  const typedWidth = (loader: HTMLElement): string =>
    (loader.firstElementChild as HTMLElement).style.width;

  it("loops the typing loader by default", () => {
    const { loader, error, text } = renderPage();
    expect(loader).not.toHaveClass("invisible");
    expect(loader.firstElementChild).toHaveClass("animate-typing-loader-typed");
    expect(error).toHaveClass("invisible");
    expect(text).toHaveClass("invisible");
    expect(text).toHaveTextContent("Loading...");
  });

  it("switches between error, progress and looping", async () => {
    const { loader, error, text } = renderPage();

    LoadingPageState.showError();
    expect(loader).toHaveClass("invisible");
    expect(error).not.toHaveClass("invisible");

    await LoadingPageState.showBar();
    expect(error).toHaveClass("invisible");
    expect(loader).not.toHaveClass("invisible");
    expect(loader.firstElementChild).not.toHaveClass(
      "animate-typing-loader-typed",
    );

    LoadingPageState.showSpinner();
    expect(loader.firstElementChild).toHaveClass("animate-typing-loader-typed");
    expect(text).toHaveClass("invisible");
  });

  it("updateText shows text, mode change hides it", () => {
    const { text } = renderPage();

    LoadingPageState.updateText("Downloading results...");
    expect(text).not.toHaveClass("invisible");
    expect(text).toHaveTextContent("Downloading results...");

    LoadingPageState.showError();
    expect(text).toHaveClass("invisible");
  });

  it("updateBar types letters for the progress and resolves on complete", async () => {
    const { loader } = renderPage();
    await LoadingPageState.showBar();

    await LoadingPageState.updateBar(45, 500);

    expect(mockAnimate).toHaveBeenLastCalledWith(
      expect.any(Object),
      expect.objectContaining({
        percentage: 45,
        duration: 500,
        ease: "linear",
      }),
    );
    expect(typedWidth(loader)).toBe("3ch");
  });

  it("settles an unfinished keyframe when the component is disposed", async () => {
    const cancel = vi.fn();
    renderPage();
    mockAnimate.mockImplementationOnce(() => ({ cancel }));
    const pending = LoadingPageState.updateBar(90, 2000);
    cleanup();
    await pending;
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("starts new progress at zero after leaving the previous load", async () => {
    const { loader } = renderPage();
    await LoadingPageState.showBar();
    await LoadingPageState.updateBar(90, 1000);
    expect(typedWidth(loader)).toBe("6ch");
    LoadingPageState.showSpinner();
    await LoadingPageState.showBar();
    expect(typedWidth(loader)).toBe("0ch");
  });

  it("completes progress immediately with reduced motion", async () => {
    motion.reduced = true;
    renderPage();
    await LoadingPageState.updateBar(100, 1000);
    expect(mockAnimate).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ percentage: 100, duration: 0 }),
    );
  });

  it("announces loading status and failure details", () => {
    const { getByRole } = render(() => <LoadingPage />);
    expect(getByRole("status")).toHaveAccessibleName("Loading");
    LoadingPageState.showError();
    LoadingPageState.updateText("Could not download your results.");
    expect(getByRole("status")).toHaveAccessibleName("Loading failed");
    expect(getByRole("status")).toHaveTextContent(
      "Could not download your results.",
    );
  });
});
