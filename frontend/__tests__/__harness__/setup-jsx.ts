//extend expect with dom matchers
import "@testing-library/jest-dom";
import { beforeEach, vi } from "vite-plus/test";

// jsdom does not implement media queries; component tests default to a fine pointer.
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string): MediaQueryList =>
      Object.assign(new EventTarget(), {
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    ),
  });
});
