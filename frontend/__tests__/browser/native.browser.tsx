/// <reference types="vite/client" />
import { cleanup, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { z } from "zod";

import "../../src/app/app.css";
import { Button } from "../../src/ts/components/common/Button";
import Select from "../../src/ts/components/ui/Select";
import { LocalStorageWithSchema } from "../../src/ts/utils/local-storage-with-schema";
import { isEditableElement } from "../../src/ts/utils/type-to-search";

afterEach(() => {
  cleanup();
  localStorage.removeItem("browser-pilot");
});

it("selects with browser keyboard input and moves focus with Tab", async () => {
  const [value, setValue] = createSignal("apple");
  render(() => (
    <>
      <Select
        label="Pilot fruit"
        options={[
          { value: "apple", text: "Apple" },
          { value: "banana", text: "Banana" },
        ]}
        selected={value()}
        onChange={setValue}
      />
      <button type="button">Next field</button>
    </>
  ));
  const combo = page.getByRole("combobox", { name: "Pilot fruit" });
  await combo.click();
  await combo.fill("ban");
  await userEvent.keyboard("{Enter}");
  expect(value()).toBe("banana");
  await expect.poll(() => combo.element()).toHaveValue("Banana");
  await expect.poll(() => combo.element()).toHaveFocus();
  await userEvent.keyboard("{Tab}");
  await expect
    .poll(() => page.getByRole("button", { name: "Next field" }).element())
    .toHaveFocus();
});

it("uses native button activation and reports trusted input events", async () => {
  const activate = vi.fn();
  render(() => <Button text="Pilot action" onClick={activate} />);
  const button = page.getByRole("button", { name: "Pilot action" });
  await button.click();
  await userEvent.keyboard("{Enter}");
  expect(activate).toHaveBeenCalledTimes(2);
  const event = activate.mock.calls[0]?.[0] as MouseEvent;
  expect(event.isTrusted).toBe(true);
  expect(button.element().getBoundingClientRect().width).toBeGreaterThan(0);
  expect(getComputedStyle(button.element()).display).toBe("inline-flex");
});

it("recognizes real contenteditable behavior without overriding browser properties", () => {
  const { getByRole } = render(() => (
    <div contentEditable role="textbox" aria-label="Pilot editor">
      Type here
    </div>
  ));
  const editor = getByRole("textbox", { name: "Pilot editor" });
  expect(editor.isContentEditable).toBe(true);
  expect(isEditableElement(editor)).toBe(true);
});

it("persists validated settings through the real browser Storage API", () => {
  const options = {
    key: "browser-pilot",
    schema: z.object({ fontSize: z.number() }),
    fallback: { fontSize: 16 },
  };
  expect(new LocalStorageWithSchema(options).set({ fontSize: 24 })).toBe(true);
  expect(localStorage.getItem(options.key)).toBe('{"fontSize":24}');
  expect(new LocalStorageWithSchema(options).get()).toEqual({ fontSize: 24 });
});
