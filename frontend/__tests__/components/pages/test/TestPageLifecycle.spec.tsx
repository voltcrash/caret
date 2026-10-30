vi.mock("../../../../src/ts/input/listeners", () => ({
  bindInputListenersTo: vi.fn(),
}));
import { cleanup, render } from "@solidjs/testing-library";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const { state, callbacks } = vi.hoisted(() => ({
  state: {
    focused: false,
    result: false,
    active: false,
    mode: "words",
    warning: true,
  },
  callbacks: {
    setFocus: vi.fn(),
    showCaret: vi.fn(),
    hideCaret: vi.fn(),
    restart: vi.fn(),
  },
}));
vi.mock("../../../../src/ts/config/store", () => ({
  getMutableConfig: (() => {
    const storedConfig = {
      get mode() {
        return state.mode;
      },
      get showOutOfFocusWarning() {
        return state.warning;
      },
    };
    return () => storedConfig;
  })(),
}));
vi.mock("../../../../src/ts/input/input-element", () => ({
  isInputElementFocused: () => state.focused,
}));
vi.mock("../../../../src/ts/states/test", () => ({
  getResultVisible: () => state.result,
  isTestActive: () => state.active,
  setTestFocusState: callbacks.setFocus,
}));
vi.mock("../../../../src/features/typing/runtime/caret", () => ({
  show: callbacks.showCaret,
  hide: callbacks.hideCaret,
}));
vi.mock("../../../../src/features/typing/runtime/test-logic", () => ({
  restart: callbacks.restart,
}));

import { TestPageLifecycle } from "../../../../src/features/typing/components/TestPageLifecycle";

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(state, {
    focused: false,
    result: false,
    active: false,
    mode: "words",
    warning: true,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function mount(): {
  input: HTMLTextAreaElement;
  unmount: () => void;
} {
  const input = document.createElement("textarea");
  const { unmount } = render(() => <TestPageLifecycle input={input} />);
  return { input, unmount };
}
describe("Test page lifecycle", () => {
  it("preserves input focus and caret behavior", () => {
    const { input } = mount();
    state.focused = true;
    input.dispatchEvent(new FocusEvent("focus"));
    expect(callbacks.setFocus).toHaveBeenCalledWith("focused");
    expect(callbacks.showCaret).toHaveBeenCalledWith(true);
    state.focused = false;
    input.dispatchEvent(new FocusEvent("focusout"));
    expect(callbacks.setFocus).toHaveBeenCalledWith("unfocused");
    expect(callbacks.hideCaret).toHaveBeenCalledOnce();
  });
  it.each(["time", "words", "quote"])(
    "preserves the initial %s wordset without a preceding focus loss",
    (mode) => {
      state.mode = mode;
      mount();
      window.dispatchEvent(new Event("focus"));
      expect(callbacks.setFocus).toHaveBeenLastCalledWith("unfocused");
      state.focused = true;
      window.dispatchEvent(new Event("focus"));
      expect(callbacks.setFocus).toHaveBeenLastCalledWith("focused");
      state.active = true;
      window.dispatchEvent(new Event("focus"));
      state.active = false;
      state.result = true;
      window.dispatchEvent(new Event("focus"));
      state.result = false;
      window.dispatchEvent(new Event("focus"));
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      expect(callbacks.restart).not.toHaveBeenCalled();
      expect(callbacks.showCaret).toHaveBeenCalledWith(true);
    },
  );
  it.each(["time", "words"])(
    "refreshes an unstarted %s test after switching away and back",
    (mode) => {
      state.mode = mode;
      mount();
      window.dispatchEvent(new Event("blur"));
      expect(callbacks.restart).not.toHaveBeenCalled();
      window.dispatchEvent(new Event("focus"));
      expect(callbacks.restart).toHaveBeenCalledExactlyOnceWith({
        noAnim: true,
      });
      window.dispatchEvent(new Event("focus"));
      expect(callbacks.restart).toHaveBeenCalledOnce();
    },
  );
  it.each(["quote", "custom", "zen"])(
    "preserves %s content after switching away and back",
    (mode) => {
      state.mode = mode;
      mount();
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("focus"));
      expect(callbacks.restart).not.toHaveBeenCalled();
    },
  );
  it.each(["active", "result"] as const)(
    "preserves an %s test and consumes its focus loss",
    (status) => {
      state[status] = true;
      mount();
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("focus"));
      expect(callbacks.restart).not.toHaveBeenCalled();
      state[status] = false;
      window.dispatchEvent(new Event("focus"));
      expect(callbacks.restart).not.toHaveBeenCalled();
    },
  );
  it("refreshes on tab visibility alone and waits until visible", () => {
    const visibility = vi.spyOn(document, "visibilityState", "get");
    mount();
    visibility.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    expect(callbacks.restart).not.toHaveBeenCalled();
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(callbacks.restart).toHaveBeenCalledExactlyOnceWith({
      noAnim: true,
    });
  });
  it.each(["focus", "visibilitychange"])(
    "refreshes once per tab return when %s arrives first",
    (firstEvent) => {
      const visibility = vi.spyOn(document, "visibilityState", "get");
      mount();
      for (let visit = 1; visit <= 2; visit++) {
        window.dispatchEvent(new Event("blur"));
        visibility.mockReturnValue("hidden");
        document.dispatchEvent(new Event("visibilitychange"));
        visibility.mockReturnValue("visible");
        const focus = (): void => {
          window.dispatchEvent(new Event("focus"));
        };
        const visible = (): void => {
          document.dispatchEvent(new Event("visibilitychange"));
        };
        if (firstEvent === "focus") {
          focus();
          visible();
        } else {
          visible();
          focus();
        }
        expect(callbacks.restart).toHaveBeenCalledTimes(visit);
      }
    },
  );
  it("refreshes even when the out-of-focus warning is disabled", () => {
    state.warning = false;
    mount();
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
    expect(callbacks.restart).toHaveBeenCalledOnce();
  });
  it("preserves words when only the typing input loses focus", () => {
    const { input } = mount();
    input.dispatchEvent(new FocusEvent("focusout"));
    state.focused = true;
    input.dispatchEvent(new FocusEvent("focus"));
    window.dispatchEvent(new Event("focus"));
    expect(callbacks.restart).not.toHaveBeenCalled();
  });
  it("signals hidden windows and removes every listener on disposal", () => {
    const { input, unmount } = mount();
    window.dispatchEvent(new Event("blur"));
    expect(callbacks.setFocus).toHaveBeenCalledWith("unfocusedWindow");
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(callbacks.setFocus).toHaveBeenCalledTimes(2);
    unmount();
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    input.dispatchEvent(new FocusEvent("focusout"));
    expect(callbacks.setFocus).toHaveBeenCalledTimes(2);
    expect(callbacks.restart).not.toHaveBeenCalled();
    expect(callbacks.hideCaret).not.toHaveBeenCalled();
  });
});
