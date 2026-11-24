import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, expect, it, vi } from "vite-plus/test";

import { Setting } from "../../../src/features/settings/components/Setting";
import {
  highlightSetting,
  setHighlightedSetting,
} from "../../../src/features/settings/state/settings-highlight";
afterEach(() => {
  cleanup();
  setHighlightedSetting(null);
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("scrolls and highlights after 250ms, clears the previous setting, and cancels on disposal", () => {
  vi.useFakeTimers();
  const scroll = vi.fn();
  const { container, unmount } = render(() => (
    <Setting
      key="test"
      title="test"
      description="test"
      fa={{ icon: "fa-cog" }}
    />
  ));
  const element = container.querySelector('[data-setting-key="test"]');
  Object.defineProperty(element, "scrollIntoView", { value: scroll });
  highlightSetting("test");
  vi.advanceTimersByTime(249);
  expect(element).not.toHaveClass("settings-highlight");
  vi.advanceTimersByTime(1);
  expect(element).toHaveClass("settings-highlight");
  expect(scroll).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
  highlightSetting(null);
  expect(element).not.toHaveClass("settings-highlight");
  highlightSetting("test");
  unmount();
  vi.advanceTimersByTime(250);
  expect(scroll).toHaveBeenCalledOnce();
});
it("calls onHighlight before scrolling", () => {
  vi.useFakeTimers();
  const onHighlight = vi.fn();
  const { container } = render(() => (
    <Setting
      key="test"
      title="test"
      description="test"
      fa={{ icon: "fa-cog" }}
      onHighlight={onHighlight}
    />
  ));
  const element = container.querySelector('[data-setting-key="test"]');
  Object.defineProperty(element, "scrollIntoView", { value: vi.fn() });
  highlightSetting("test");
  expect(onHighlight).toHaveBeenCalledOnce();
  expect(element).not.toHaveClass("settings-highlight");
});
