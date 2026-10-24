import { describe, expect, it } from "vite-plus/test";

import {
  isEditableElement,
  isTypeToSearchKey,
} from "../../src/ts/utils/type-to-search";

describe("isEditableElement", () => {
  it("accepts form fields", () => {
    expect(isEditableElement(document.createElement("input"))).toBe(true);
    expect(isEditableElement(document.createElement("textarea"))).toBe(true);
    expect(isEditableElement(document.createElement("select"))).toBe(true);
  });

  it("accepts contenteditable elements", () => {
    const div = document.createElement("div");
    div.contentEditable = "true";
    expect(isEditableElement(div)).toBe(true);
  });

  it("rejects other elements", () => {
    expect(isEditableElement(null)).toBe(false);
    expect(isEditableElement(document.body)).toBe(false);
    expect(isEditableElement(document.createElement("button"))).toBe(false);
  });
});

describe("isTypeToSearchKey", () => {
  const key = (init: KeyboardEventInit): boolean =>
    isTypeToSearchKey(new KeyboardEvent("keydown", init));

  it("accepts printable characters", () => {
    expect(key({ key: "a" })).toBe(true);
    expect(key({ key: "A", shiftKey: true })).toBe(true);
    expect(key({ key: "1" })).toBe(true);
    expect(key({ key: "é" })).toBe(true);
    expect(key({ key: "😀" })).toBe(true);
    expect(key({ key: "å", altKey: true })).toBe(true);
    expect(
      key({ key: "@", ctrlKey: true, altKey: true, modifierAltGraph: true }),
    ).toBe(true);
  });

  it("rejects space, named keys and shortcuts", () => {
    expect(key({ key: " " })).toBe(false);
    expect(key({ key: "Enter" })).toBe(false);
    expect(key({ key: "Tab" })).toBe(false);
    expect(key({ key: "Escape" })).toBe(false);
    expect(key({ key: "Dead" })).toBe(false);
    expect(key({ key: "k", metaKey: true })).toBe(false);
    expect(key({ key: "k", ctrlKey: true })).toBe(false);
  });

  it("rejects keys while composing", () => {
    expect(key({ key: "a", isComposing: true })).toBe(false);
  });
});
