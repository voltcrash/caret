import { cleanup, render } from "@solidjs/testing-library";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const { state, focusWords, unfocus, popupVisible, notify } = vi.hoisted(() => ({
  state: {
    transition: false,
    focus: false,
    page: "test",
    result: false,
    inputFocused: false,
    popup: false,
    warning: true,
  },
  focusWords: vi.fn(),
  unfocus: vi.fn(),
  popupVisible: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("../../../src/ts/config/store", () => ({
  getMutableConfig: (() => {
    const storedConfig = {
      get showOutOfFocusWarning() {
        return state.warning;
      },
    };
    return () => storedConfig;
  })(),
}));
vi.mock("../../../src/ts/states/core", () => ({
  getActivePage: () => state.page,
}));
vi.mock("../../../src/ts/states/page-transition", () => ({
  get: () => state.transition,
}));
vi.mock("../../../src/ts/states/test", () => ({
  getResultVisible: () => state.result,
  getFocus: () => state.focus,
}));
vi.mock("../../../src/ts/input/input-element", () => ({
  isInputElementFocused: () => state.inputFocused,
}));
vi.mock("../../../src/ts/test/test-ui", () => ({ focusWords }));
vi.mock("../../../src/ts/states/overlay-visibility", () => ({
  isAnyPopupVisible: () => {
    popupVisible();
    return state.popup;
  },
}));
vi.mock("../../../src/ts/utils/env", () => ({ isDevEnvironment: () => true }));
vi.mock("../../../src/ts/states/notifications", () => ({
  showErrorNotification: notify,
}));

vi.mock("../../../src/ts/test/focus", () => ({ set: unfocus }));

import { GlobalEvents } from "../../../src/ts/components/core/GlobalEvents";
import { connectionEvent } from "../../../src/ts/events/connection";

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(state, {
    transition: false,
    focus: false,
    page: "test",
    result: false,
    inputFocused: false,
    popup: false,
    warning: true,
  });
});
afterEach(cleanup);
function press(
  key: string,
  target: HTMLElement = document.body,
  options: KeyboardEventInit = {},
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
}

describe("Global events", () => {
  it("owns online/offline listeners even when mounted after window load", () => {
    const dispatch = vi.spyOn(connectionEvent, "dispatch");
    const { unmount } = render(() => <GlobalEvents />);
    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("online"));
    expect(dispatch.mock.calls).toEqual([[false], [true]]);
    unmount();
    window.dispatchEvent(new Event("offline"));
    expect(dispatch).toHaveBeenCalledTimes(2);
    dispatch.mockRestore();
  });

  it("unfocuses only for positive mouse movement above the legacy threshold", () => {
    const { unmount } = render(() => <GlobalEvents />);
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
    expect(unfocus).not.toHaveBeenCalled();
    move(4, 0);
    expect(unfocus).toHaveBeenCalledWith(false);
    state.transition = true;
    move(10, 10);
    unmount();
    move(10, 10);
    expect(unfocus).toHaveBeenCalledOnce();
  });
  it("autofocuses eligible keys and preserves warning/modifier behavior", () => {
    render(() => <GlobalEvents />);
    expect(press("a").defaultPrevented).toBe(true);
    expect(focusWords).toHaveBeenCalledOnce();
    state.warning = false;
    expect(press("b").defaultPrevented).toBe(false);
    for (const key of ["Enter", " ", "Escape", "Tab", "Shift"]) press(key);
    press("c", document.body, { ctrlKey: true });
    expect(focusWords).toHaveBeenCalledTimes(2);
  });

  it("skips transitions, results, focused inputs and popups", () => {
    render(() => <GlobalEvents />);
    for (const field of ["transition", "result", "inputFocused"] as const) {
      state[field] = true;
      press("a");
      state[field] = false;
    }
    expect(popupVisible).not.toHaveBeenCalled();
    state.popup = true;
    press("a");
    expect(focusWords).not.toHaveBeenCalled();
    expect(popupVisible).toHaveBeenCalledOnce();
  });

  it("prevents space scrolling on body/results and cleans up handlers", () => {
    const previousError = window.onerror;
    const previousRejection = window.onunhandledrejection;
    const { unmount } = render(() => <GlobalEvents />);
    const result = document.createElement("div");
    result.id = "result";
    document.body.append(result);
    expect(press(" ", document.body, { code: "Space" }).defaultPrevented).toBe(
      true,
    );
    expect(press(" ", result, { code: "Space" }).defaultPrevented).toBe(true);
    unmount();
    expect(window.onerror).toBe(previousError);
    expect(window.onunhandledrejection).toBe(previousRejection);
    expect(press(" ", document.body, { code: "Space" }).defaultPrevented).toBe(
      false,
    );
    press("a");
    expect(focusWords).not.toHaveBeenCalled();
    result.remove();
  });
});
