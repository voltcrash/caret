import { createEffect, createRoot } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { mountApplication } from "../../src/app/application";
import { createAppSignal, createAppStore } from "../../src/app/state";
import {
  createTestApplication,
  releaseTestApplication,
} from "../__harness__/test-application";

releaseTestApplication();

describe("app-owned state", () => {
  it("copies store properties without leaking Solid's proxy metadata", () => {
    const [settings, setSettings] = createAppStore({ language: "english" });
    const app = createTestApplication();
    const release = mountApplication(app.application);
    try {
      expect({ ...settings }).toEqual({ language: "english" });
      expect(Object.assign({}, settings)).toEqual({ language: "english" });
      expect(Object.keys(settings)).toEqual(["language"]);
      setSettings("language", "german");
      expect({ ...settings }).toEqual({ language: "german" });
    } finally {
      app.dispose();
      release();
    }
  });

  it("keeps copied stores reactive across application remounts", () => {
    const [settings, setSettings] = createAppStore({ value: 1 });
    for (let i = 0; i < 2; i++) {
      const app = createTestApplication();
      const release = mountApplication(app.application);
      const snapshots: { value: number }[] = [];
      const dispose = createRoot((dispose) => {
        createEffect(() => snapshots.push({ ...settings }));
        return dispose;
      });
      try {
        expect(snapshots).toEqual([{ value: 1 }]);
        setSettings("value", 2);
        expect(snapshots).toEqual([{ value: 1 }, { value: 2 }]);
      } finally {
        dispose();
        app.dispose();
        release();
      }
    }
  });

  it("preserves array length descriptors while copying array stores", () => {
    const [items, setItems] = createAppStore(["first", "second"]);
    const app = createTestApplication();
    const release = mountApplication(app.application);
    try {
      expect({ ...items }).toEqual({ 0: "first", 1: "second" });
      expect(Object.getOwnPropertyDescriptor(items, "length")).toEqual({
        value: 2,
        writable: true,
        enumerable: false,
        configurable: false,
      });
      expect(Object.keys(items)).toEqual(["0", "1"]);
      setItems(["third"]);
      expect({ ...items }).toEqual({ 0: "third" });
      expect(Object.getOwnPropertyDescriptor(items, "length")?.value).toBe(1);
    } finally {
      app.dispose();
      release();
    }
  });

  it("keeps domain accessors reactive and recreates data on remount", () => {
    const [count, setCount] = createAppSignal(0);
    const [items, setItems] = createAppStore<{ value: number }[]>([]);
    for (let i = 0; i < 2; i++) {
      const app = createTestApplication();
      const release = mountApplication(app.application);
      const seen: number[] = [];
      const dispose = createRoot((dispose) => {
        createEffect(() => seen.push(count()));
        return dispose;
      });
      expect(count()).toBe(0);
      expect(items.length).toBe(0);
      setCount(1);
      setItems([{ value: 2 }]);
      expect(seen).toEqual([0, 1]);
      expect(Array.isArray(items)).toBe(true);
      expect([...items]).toEqual([{ value: 2 }]);
      expect(JSON.stringify(items)).toBe('[{"value":2}]');
      dispose();
      app.dispose();
      release();
    }
  });
});
