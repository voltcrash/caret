import { render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { expect, it, vi } from "vite-plus/test";
const { getPage } = vi.hoisted(() => ({ getPage: vi.fn() }));
vi.mock("../../../src/ts/states/core", () => ({ getActivePage: getPage }));
import { ModifierEvents } from "../../../src/ts/components/core/ModifierEvents";
import { getModifierState } from "../../../src/ts/states/modifiers";

it("tracks modifiers only while the typing page owns listeners", () => {
  const [page, setPage] = createSignal("test");
  getPage.mockImplementation(page);
  const { unmount } = render(() => <ModifierEvents />);
  const key = (type: string, code: string): void => {
    document.dispatchEvent(new KeyboardEvent(type, { code }));
  };
  key("keydown", "ShiftLeft");
  key("keydown", "ShiftRight");
  key("keyup", "ShiftLeft");
  expect(getModifierState()).toMatchObject({
    shift: true,
    leftShift: false,
    rightShift: true,
  });
  setPage("settings");
  key("keydown", "AltLeft");
  expect(getModifierState()).toMatchObject({ shift: false, alt: false });
  setPage("test");
  key("keydown", "AltLeft");
  expect(getModifierState().alt).toBe(true);
  unmount();
  key("keydown", "ShiftLeft");
  expect(getModifierState()).toMatchObject({ shift: false, alt: false });
});
