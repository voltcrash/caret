import { createEffect, createRoot } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { mountApplication } from "../../src/app/application";
import { createAppSignal, createAppStore } from "../../src/app/state";
import {
  createTestApplication,
  releaseTestApplication,
} from "../__harness__/mock-application";

releaseTestApplication();

describe("app-owned state", () => {
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
