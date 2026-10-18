import { cleanup, render } from "@solidjs/testing-library";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock("../../../src/ts/utils/env", () => ({ isDevEnvironment: () => true }));
vi.mock("../../../src/ts/states/notifications", () => ({
  showErrorNotification: notify,
}));

import { GlobalEvents } from "../../../src/ts/components/core/GlobalEvents";
import { connectionEvent } from "../../../src/ts/events/connection";

beforeEach(() => vi.clearAllMocks());
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
    result.remove();
  });
});
