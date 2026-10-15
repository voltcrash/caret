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
vi.mock("../../../../src/ts/test/caret", () => ({
  show: callbacks.showCaret,
  hide: callbacks.hideCaret,
}));
vi.mock("../../../../src/ts/test/test-logic", () => ({
  restart: callbacks.restart,
}));

import { TestPageLifecycle } from "../../../../src/ts/components/pages/test/TestPageLifecycle";

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
  it("restarts only idle time/words tests on window focus or visible pages", () => {
    mount();
    window.dispatchEvent(new Event("focus"));
    expect(callbacks.restart).toHaveBeenCalledWith({ noAnim: true });
    state.active = true;
    window.dispatchEvent(new Event("focus"));
    state.active = false;
    state.result = true;
    window.dispatchEvent(new Event("focus"));
    state.result = false;
    state.mode = "quote";
    window.dispatchEvent(new Event("focus"));
    expect(callbacks.restart).toHaveBeenCalledOnce();
    state.mode = "time";
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(callbacks.restart).toHaveBeenCalledTimes(2);
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
