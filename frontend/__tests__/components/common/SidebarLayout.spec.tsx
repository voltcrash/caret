import { cleanup, render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const { state } = vi.hoisted(() => ({ state: { popup: false } }));
vi.mock("../../../src/ts/states/overlay-visibility", () => ({
  isAnyPopupVisible: () => state.popup,
}));

// Control resize notifications independently of browser layout.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe = vi.fn();
    disconnect = vi.fn();
  },
);

import { SidebarLayout } from "../../../src/ts/components/common/SidebarLayout";

afterEach(() => {
  cleanup();
  state.popup = false;
});

const items = {
  one: { text: "one", icon: "fa-tools" },
  two: { text: "two", icon: "fa-keyboard" },
} as const;

// The test browser uses Linux, so mod is ctrl.
function pressMod(key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    code: `Digit${key}`,
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  document.body.dispatchEvent(event);
  document.body.dispatchEvent(
    new KeyboardEvent("keyup", { key, code: `Digit${key}`, bubbles: true }),
  );
  return event;
}

function renderSidebar(
  hotkeys: () => boolean = () => true,
): ReturnType<typeof vi.fn> {
  const onSelect = vi.fn();
  render(() => (
    <SidebarLayout
      items={items}
      active="one"
      onSelect={onSelect}
      hotkeys={hotkeys()}
    >
      content
    </SidebarLayout>
  ));
  return onSelect;
}

describe("SidebarLayout hotkeys", () => {
  it("selects the item at the pressed number", () => {
    const onSelect = renderSidebar();
    const event = pressMod("2");
    expect(onSelect).toHaveBeenCalledWith("two");
    // keeps the browser from switching tabs
    expect(event.defaultPrevented).toBe(true);
    pressMod("1");
    expect(onSelect).toHaveBeenLastCalledWith("one");
  });

  it("ignores numbers without an item", () => {
    const onSelect = renderSidebar();
    const event = pressMod("3");
    expect(onSelect).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("does nothing while disabled or a popup is open", () => {
    const [enabled, setEnabled] = createSignal(false);
    const onSelect = renderSidebar(enabled);
    pressMod("1");
    expect(onSelect).not.toHaveBeenCalled();

    setEnabled(true);
    state.popup = true;
    pressMod("1");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("stops listening once unmounted", () => {
    const onSelect = renderSidebar();
    cleanup();
    pressMod("1");
    expect(onSelect).not.toHaveBeenCalled();
  });
});

function holdMod(down: boolean): void {
  document.body.dispatchEvent(
    new KeyboardEvent(down ? "keydown" : "keyup", {
      key: "Control",
      code: "ControlLeft",
      ctrlKey: down,
      bubbles: true,
    }),
  );
}

describe("SidebarLayout hotkey hints", () => {
  afterEach(() => holdMod(false));

  const hints = (): string[] =>
    [...document.querySelectorAll("kbd")].map((kbd) => kbd.textContent);

  it("shows each item's hotkey while mod is held", () => {
    renderSidebar();
    expect(hints()).toEqual([]);
    holdMod(true);
    expect(hints()).toEqual(["Ctrl+1", "Ctrl+2"]);
    holdMod(false);
    expect(hints()).toEqual([]);
  });

  it("replaces counts while held", () => {
    render(() => (
      <SidebarLayout
        items={items}
        active={undefined}
        onSelect={vi.fn()}
        counts={{ one: 3 }}
        hotkeys
      >
        content
      </SidebarLayout>
    ));
    expect(screen.getByText("3")).toBeTruthy();
    holdMod(true);
    expect(screen.queryByText("3")).toBeNull();
    expect(hints()).toEqual(["Ctrl+1", "Ctrl+2"]);
  });

  it("hides hints while disabled or a popup is open", () => {
    renderSidebar(() => false);
    holdMod(true);
    expect(hints()).toEqual([]);
    cleanup();
    holdMod(false);

    state.popup = true;
    renderSidebar();
    holdMod(true);
    expect(hints()).toEqual([]);
  });
});
