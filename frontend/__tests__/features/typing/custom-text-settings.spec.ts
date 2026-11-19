import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import * as CustomText from "../../../src/features/typing/runtime/content/custom-text";

afterEach(() => vi.restoreAllMocks());

describe("custom text settings reads", () => {
  it("reads limits and flags without cloning the stored text", () => {
    CustomText.setText(Array.from({ length: 5000 }, (_, i) => `word${i}`));
    CustomText.setLimitMode("time");
    CustomText.setLimitValue(60);
    const clone = vi.spyOn(globalThis, "structuredClone");
    expect(CustomText.getLimitMode()).toBe("time");
    expect(CustomText.getLimitValue()).toBe(60);
    expect(CustomText.getLimit()).toEqual({ mode: "time", value: 60 });
    expect(typeof CustomText.getMode()).toBe("string");
    expect(typeof CustomText.getPipeDelimiter()).toBe("boolean");
    expect(clone).not.toHaveBeenCalled();
  });

  it("returns limits callers can mutate without changing settings", () => {
    CustomText.setLimitMode("word");
    CustomText.setLimitValue(10);
    const limit = CustomText.getLimit();
    limit.value = 999;
    expect(CustomText.getLimitValue()).toBe(10);
    expect(CustomText.getData().text.length).toBeGreaterThan(0);
  });
});
