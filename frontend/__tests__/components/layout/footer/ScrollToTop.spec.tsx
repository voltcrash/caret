import { render } from "@solidjs/testing-library";
import { userEvent } from "@testing-library/user-event";
import { createSignal } from "solid-js";
import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

import { TypingRouteHost } from "../../../../src/components/typing-route-host";
import { ScrollToTop } from "../../../../src/ts/components/layout/footer/ScrollToTop";
import { setPageScroller } from "../../../../src/ts/states/page-layout";

describe("ScrollToTop", () => {
  const [typing, setTyping] = createSignal(false);
  beforeEach(() => {
    setTyping(false);
    Object.defineProperty(window, "scrollY", { value: 0, writable: true });
  });

  function renderElement(): {
    container: HTMLElement;
    button: HTMLButtonElement;
  } {
    const { container } = render(() => (
      <TypingRouteHost.Provider value={typing}>
        <ScrollToTop />
      </TypingRouteHost.Provider>
    ));

    const wrapper = container.firstElementChild;
    const button = container.querySelector("button");
    if (!(wrapper instanceof HTMLElement) || button === null) {
      throw new Error("Missing fixture scroll control");
    }
    return { container: wrapper, button };
  }

  it("renders with correct classes and structure", () => {
    const { container, button } = renderElement();

    expect(container).toHaveClass("content-grid", "ScrollToTop");
    expect(button).toHaveClass("breakout");
    expect(button.querySelector("i")).toHaveClass("fas", "fa-angle-double-up");
  });

  it("renders invisible when scrollY is 0", () => {
    const { button } = renderElement();

    expect(button).toHaveClass("opacity-0");
  });

  it("becomes visible when scrollY > 100 on non-test pages", () => {
    const { button } = renderElement();
    scrollTo(150);

    expect(button).not.toHaveClass("opacity-0");
  });

  it("stays invisible on test page at scroll 0", () => {
    setTyping(true);
    const { button } = renderElement();

    expect(button).toHaveClass("opacity-0");
  });

  it("stays invisible on test page even with scroll > 100", () => {
    setTyping(true);
    const { button } = renderElement();
    scrollTo(150);

    expect(button).toHaveClass("opacity-0");
  });

  it("becomes invisible when scroll < 100 on non-test pages", () => {
    const { button } = renderElement();
    scrollTo(150);
    expect(button).not.toHaveClass("opacity-0");

    scrollTo(50);
    expect(button).toHaveClass("opacity-0");
  });

  it("scrolls to top and hides button on click", async () => {
    const scrollToSpy = vi.fn();
    window.scrollTo = scrollToSpy;
    const { button } = renderElement();
    scrollTo(150);

    await userEvent.click(button);

    expect(scrollToSpy).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });
    expect(button).toHaveClass("opacity-0");
  });

  it("cleans up scroll listener on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(() => (
      <TypingRouteHost.Provider value={typing}>
        <ScrollToTop />
      </TypingRouteHost.Provider>
    ));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
    );
  });

  it("follows the page scroll container when there is one", async () => {
    const scroller = document.createElement("div");
    const scrollToSpy = vi.fn();
    scroller.scrollTo = scrollToSpy;
    setPageScroller(scroller);
    const { button } = renderElement();

    scroller.scrollTop = 150;
    scroller.dispatchEvent(new Event("scroll"));
    expect(button).not.toHaveClass("opacity-0");

    await userEvent.click(button);
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });

    setPageScroller(undefined);
  });

  function scrollTo(value: number): void {
    Object.defineProperty(window, "scrollY", { value, writable: true });
    window.dispatchEvent(new Event("scroll"));
  }
});
