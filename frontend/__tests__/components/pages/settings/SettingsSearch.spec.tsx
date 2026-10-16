import { cleanup, render } from "@solidjs/testing-library";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const { state } = vi.hoisted(() => ({
  state: { popup: false },
}));
vi.mock("../../../../src/ts/states/overlay-visibility", () => ({
  isAnyPopupVisible: () => state.popup,
}));

import { SettingsSearch } from "../../../../src/ts/components/pages/settings/SettingsSearch";
import { setSettingsSearch } from "../../../../src/ts/states/settings-search";

beforeEach(() => {
  Object.assign(state, { popup: false });
});
afterEach(() => {
  cleanup();
  setSettingsSearch("");
});

function press(
  key: string,
  target: Element = document.body,
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

function renderSearch(): HTMLInputElement {
  const { container } = render(() => <SettingsSearch />);
  return container.querySelector("input") as HTMLInputElement;
}

describe("SettingsSearch type to search", () => {
  it("focuses the search input when typing anywhere", () => {
    const input = renderSearch();
    setSettingsSearch("caret");
    const event = press("s");
    expect(document.activeElement).toBe(input);
    // the browser inserts the character, so the event isn't swallowed
    expect(event.defaultPrevented).toBe(false);
    expect(input.selectionStart).toBe("caret".length);
  });

  it("focuses on backspace only when there's a query to edit", () => {
    const input = renderSearch();
    press("Backspace");
    expect(document.activeElement).not.toBe(input);
    setSettingsSearch("caret");
    press("Backspace", document.body, { metaKey: true });
    expect(document.activeElement).not.toBe(input);
    press("Backspace");
    expect(document.activeElement).toBe(input);
  });

  it("ignores shortcuts and non-printable keys", () => {
    const input = renderSearch();
    press("k", document.body, { metaKey: true });
    press("k", document.body, { ctrlKey: true });
    for (const key of [" ", "Enter", "Tab", "Escape", "ArrowDown"]) press(key);
    expect(document.activeElement).not.toBe(input);
  });

  it("leaves other fields, popups and unmounted pages alone", () => {
    const input = renderSearch();
    const other = document.createElement("input");
    document.body.append(other);
    other.focus();
    press("a", other);
    expect(document.activeElement).toBe(other);
    other.remove();

    state.popup = true;
    press("a");
    expect(document.activeElement).not.toBe(input);
    state.popup = false;

    // The listener belongs to the mounted settings page only.
    cleanup();
    press("a");
    expect(document.activeElement).not.toBe(input);
  });

  it("ignores handled events", () => {
    const input = renderSearch();
    const event = new KeyboardEvent("keydown", {
      key: "a",
      bubbles: true,
      cancelable: true,
    });
    event.preventDefault();
    document.body.dispatchEvent(event);
    expect(document.activeElement).not.toBe(input);
  });

  it("stops listening once unmounted", () => {
    const { container, unmount } = render(() => <SettingsSearch />);
    const input = container.querySelector("input") as HTMLInputElement;
    unmount();
    document.body.append(input);
    press("a");
    expect(document.activeElement).not.toBe(input);
    input.remove();
  });
});
