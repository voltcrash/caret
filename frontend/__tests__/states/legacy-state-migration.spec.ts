import { createComputed, createRoot } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import * as Composition from "../../src/ts/states/composition";
import * as PageTransition from "../../src/ts/states/page-transition";
import * as SlowTimer from "../../src/ts/states/slow-timer";

function observe<T>(read: () => T): { values: T[]; dispose: () => void } {
  return createRoot((dispose) => {
    const values: T[] = [];
    createComputed(() => values.push(read()));
    return { values, dispose };
  });
}

afterEach(() => {
  Composition.setComposing(false);
  Composition.setData("");
  PageTransition.set(true);
  SlowTimer.clear();
  vi.restoreAllMocks();
});

describe("migrated state", () => {
  it("notifies composition readers independently for composing and data", () => {
    const composing = observe(Composition.getComposing);
    const data = observe(Composition.getData);
    Composition.setComposing(true);
    Composition.setData("あ");
    expect(composing.values).toEqual([false, true]);
    expect(data.values).toEqual(["", "あ"]);
    composing.dispose();
    data.dispose();
  });

  it("keeps the initial transition guard and notifies navigation readers", () => {
    const transition = observe(PageTransition.get);
    PageTransition.set(false);
    PageTransition.set(true);
    expect(transition.values).toEqual([true, false, true]);
    transition.dispose();
  });

  it("logs slow timer only once until cleared", () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const slowTimer = observe(SlowTimer.get);
    SlowTimer.set();
    SlowTimer.set();
    SlowTimer.clear();
    SlowTimer.set();
    expect(error).toHaveBeenCalledTimes(2);
    expect(slowTimer.values).toEqual([false, true, false, true]);
    slowTimer.dispose();
  });

  it("reads persisted lazy-mode preferences on first access and reacts to writes", async () => {
    vi.resetModules();
    await import("../__harness__/mock-application");
    localStorage.setItem("rememberLazyMode", "true");
    localStorage.setItem("prefersArabicLazyMode", "false");
    const storageRead = vi.spyOn(Storage.prototype, "getItem");
    const preferences = await import("../../src/ts/states/remember-lazy-mode");
    expect(storageRead).not.toHaveBeenCalled();
    expect(preferences.getRemember()).toBe(true);
    expect(preferences.getArabicPref()).toBe(false);
    const remember = observe(preferences.getRemember);
    preferences.setRemember(false);
    expect(remember.values).toEqual([true, false]);
    expect(localStorage.getItem("rememberLazyMode")).toBe("false");
    preferences.setArabicPref(true);
    expect(preferences.getArabicPref()).toBe(true);
    expect(localStorage.getItem("prefersArabicLazyMode")).toBe("true");
    remember.dispose();
    localStorage.removeItem("rememberLazyMode");
    localStorage.removeItem("prefersArabicLazyMode");
  });
});
