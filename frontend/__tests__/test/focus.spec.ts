import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { state, caret, frames } = vi.hoisted(() => ({
  state: { focused: false },
  caret: { startAnimation: vi.fn(), stopAnimation: vi.fn() },
  frames: { pending: undefined as (() => void) | undefined },
}));
vi.mock("../../src/features/typing/runtime/caret", () => caret);
vi.mock("../../src/ts/states/test", () => ({
  getFocus: () => state.focused,
  setFocus: (value: boolean) => {
    state.focused = value;
  },
}));
vi.mock("../../src/ts/utils/debounced-animation-frame", () => ({
  requestDebouncedAnimationFrame: (_id: string, callback: () => void) => {
    frames.pending = callback;
  },
}));

import * as Focus from "../../src/features/typing/runtime/focus";
import {
  isFocusCursorHidden,
  setFocusCursorHidden,
} from "../../src/ts/states/app";

beforeEach(() => {
  vi.clearAllMocks();
  state.focused = false;
  frames.pending = undefined;
  setFocusCursorHidden(false);
});
function flush(): void {
  frames.pending?.();
  frames.pending = undefined;
}

describe("Focus", () => {
  it("preserves the initial visible cursor and defers focus until the frame", () => {
    Focus.set(true, true);
    expect(state.focused).toBe(false);
    flush();
    expect(state.focused).toBe(true);
    expect(isFocusCursorHidden()).toBe(false);
    expect(caret.stopAnimation).toHaveBeenCalledOnce();
  });
  it("hides the cursor during focus and restores it when unfocused", () => {
    Focus.set(true);
    flush();
    expect(isFocusCursorHidden()).toBe(true);
    Focus.set(false);
    flush();
    expect(state.focused).toBe(false);
    expect(isFocusCursorHidden()).toBe(false);
    expect(caret.startAnimation).toHaveBeenCalledOnce();
  });
  it("ignores redundant requests", () => {
    Focus.set(false);
    expect(frames.pending).toBeUndefined();
    Focus.set(true);
    flush();
    Focus.set(true, true);
    expect(frames.pending).toBeUndefined();
    expect(isFocusCursorHidden()).toBe(true);
  });
});
