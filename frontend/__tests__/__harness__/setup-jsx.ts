//extend expect with dom matchers
import "@testing-library/jest-dom";
import { afterEach, beforeEach, vi } from "vite-plus/test";

// jsdom does not implement media queries; component tests default to a fine pointer.
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string): MediaQueryList =>
      Object.assign(new EventTarget(), {
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    ),
  );
});

afterEach(() => vi.unstubAllGlobals());
