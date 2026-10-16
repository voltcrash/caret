import { cleanup, render } from "@solidjs/testing-library";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const { state, ui, popupVisible } = vi.hoisted(() => ({
  state: {
    transition: false,
    focus: false,
    route: true,
    result: false,
    active: true,
    quickRestart: false,
    inputFocused: false,
    popup: false,
    warning: true,
  },
  ui: {
    focusWords: vi.fn(),
    unfocus: vi.fn(),
    hideCaret: vi.fn(),
    showCaret: vi.fn(),
    scrollTape: vi.fn(),
    centerLine: vi.fn(),
    hints: vi.fn(),
    positionInput: vi.fn(),
    altGr: vi.fn(),
  },
  popupVisible: vi.fn(),
}));
vi.mock("../../../src/ts/config/store", () => ({
  getMutableConfig: (() => {
    const storedConfig = {
      mode: "words",
      words: 10,
      time: 15,
      tapeMode: "off",
      get showOutOfFocusWarning() {
        return state.warning;
      },
    };
    return () => storedConfig;
  })(),
}));
vi.mock("../../../src/features/typing/scope", () => ({
  isTypingRouteActive: () => state.route,
  isTypingRouteTransitioning: () => state.transition,
}));
vi.mock("../../../src/ts/states/test", () => ({
  getResultVisible: () => state.result,
  getFocus: () => state.focus,
  isTestActive: () => state.active,
}));
vi.mock("../../../src/ts/input/input-element", () => ({
  isInputElementFocused: () => state.inputFocused,
}));
vi.mock("../../../src/ts/states/overlay-visibility", () => ({
  isAnyPopupVisible: () => {
    popupVisible();
    return state.popup;
  },
}));
vi.mock("../../../src/ts/utils/quick-restart", () => ({
  canQuickRestart: () => state.quickRestart,
}));
vi.mock("../../../src/features/typing/runtime/custom-text", () => ({
  getData: () => ({}),
}));
vi.mock("../../../src/features/typing/runtime/focus", () => ({
  set: ui.unfocus,
}));
vi.mock("../../../src/features/typing/runtime/caret", () => ({
  hide: ui.hideCaret,
  show: ui.showCaret,
}));
vi.mock("../../../src/features/typing/runtime/test-ui", () => ({
  focusWords: ui.focusWords,
  scrollTape: ui.scrollTape,
  centerActiveLine: ui.centerLine,
  updateHintsPositionDebounced: ui.hints,
  updateWordsInputPosition: ui.positionInput,
}));
vi.mock("../../../src/features/typing/runtime/layout-emulator", () => ({
  updateAltGrState: ui.altGr,
}));

import { TypingEvents } from "../../../src/features/typing/components/TypingEvents";
import {
  getModifierState,
  resetModifierState,
} from "../../../src/ts/states/modifiers";

beforeEach(() => {
  vi.clearAllMocks();
  resetModifierState();
  Object.assign(state, {
    transition: false,
    focus: false,
    route: true,
    result: false,
    active: true,
    quickRestart: false,
    inputFocused: false,
    popup: false,
    warning: true,
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function press(
  key: string,
  options: KeyboardEventInit = {},
  type = "keydown",
): KeyboardEvent {
  const event = new KeyboardEvent(type, {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  document.body.dispatchEvent(event);
  return event;
}

describe("TypingEvents", () => {
  it("autofocuses eligible keys and preserves warning/modifier behavior", () => {
    render(() => <TypingEvents />);
    expect(press("a").defaultPrevented).toBe(true);
    expect(ui.focusWords).toHaveBeenCalledOnce();
    state.warning = false;
    expect(press("b").defaultPrevented).toBe(false);
    for (const key of ["Enter", " ", "Escape", "Tab", "Shift"]) press(key);
    press("c", { ctrlKey: true });
    expect(ui.focusWords).toHaveBeenCalledTimes(2);
  });

  it("skips inactive routes, transitions, results, focused inputs and popups", () => {
    render(() => <TypingEvents />);
    for (const field of ["transition", "result", "inputFocused"] as const) {
      state[field] = true;
      press("a");
      state[field] = false;
    }
    state.route = false;
    press("a");
    state.route = true;
    expect(popupVisible).not.toHaveBeenCalled();
    state.popup = true;
    press("a");
    expect(ui.focusWords).not.toHaveBeenCalled();
    expect(popupVisible).toHaveBeenCalledOnce();
  });

  it("tracks modifiers only while the typing route is active", () => {
    const { unmount } = render(() => <TypingEvents />);
    press("Shift", { code: "ShiftLeft" });
    press("Shift", { code: "ShiftRight" });
    press("Shift", { code: "ShiftLeft" }, "keyup");
    expect(getModifierState()).toMatchObject({
      shift: true,
      leftShift: false,
      rightShift: true,
    });
    expect(ui.altGr).toHaveBeenCalledTimes(3);
    resetModifierState();
    state.route = false;
    press("Alt", { code: "AltLeft" });
    expect(getModifierState().alt).toBe(false);
    state.route = true;
    press("Alt", { code: "AltLeft" });
    expect(getModifierState().alt).toBe(true);
    unmount();
    resetModifierState();
    press("Shift", { code: "ShiftLeft" });
    expect(getModifierState().shift).toBe(false);
  });

  it("unfocuses only for positive mouse movement above the legacy threshold", () => {
    const { unmount } = render(() => <TypingEvents />);
    state.focus = true;
    const move = (x: number, y: number): void => {
      const event = new MouseEvent("mousemove");
      Object.defineProperties(event, {
        movementX: { value: x },
        movementY: { value: y },
      });
      document.dispatchEvent(event);
    };
    move(3, 3);
    move(-10, -10);
    expect(ui.unfocus).not.toHaveBeenCalled();
    move(4, 0);
    expect(ui.unfocus).toHaveBeenCalledWith(false);
    state.transition = true;
    move(10, 10);
    unmount();
    move(10, 10);
    expect(ui.unfocus).toHaveBeenCalledOnce();
  });

  it("guards active long tests on unload and cancels resize work on disposal", () => {
    vi.useFakeTimers();
    const { unmount } = render(() => <TypingEvents />);
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    state.quickRestart = true;
    const quickUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(quickUnload);
    expect(quickUnload.defaultPrevented).toBe(false);
    window.dispatchEvent(new Event("resize"));
    expect(ui.hideCaret).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(250);
    expect(ui.centerLine).toHaveBeenCalledOnce();
    unmount();
    vi.advanceTimersByTime(1000);
    expect(ui.positionInput).not.toHaveBeenCalled();
    expect(ui.showCaret).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("resize"));
    expect(ui.hideCaret).toHaveBeenCalledOnce();
    const detached = new Event("beforeunload", { cancelable: true });
    state.quickRestart = false;
    window.dispatchEvent(detached);
    expect(detached.defaultPrevented).toBe(false);
  });

  it("ignores resize recentering away from the typing route", () => {
    vi.useFakeTimers();
    render(() => <TypingEvents />);
    state.route = false;
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(1000);
    expect(ui.centerLine).not.toHaveBeenCalled();
    expect(ui.positionInput).not.toHaveBeenCalled();
  });
});
