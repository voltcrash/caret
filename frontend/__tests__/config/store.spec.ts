import { createComputed, createRoot } from "solid-js";
import { afterEach, expect, it } from "vite-plus/test";

import { setConfig } from "../../src/ts/config/setters";
import { getConfig, getMutableConfig } from "../../src/ts/config/store";
import { __testing } from "../../src/ts/config/testing";
import { configEvent } from "../../src/ts/events/config";

afterEach(() => {
  __testing.replaceConfig({});
});

it("keeps one configuration behind tracked and untracked reads", () => {
  expect(setConfig("punctuation", true, { nosave: true })).toBe(true);

  expect(getMutableConfig().punctuation).toBe(true);
  expect(getConfig.punctuation).toBe(true);
});

it("lets change listeners read the new value before reactive readers update", () => {
  const order: string[] = [];
  createRoot((dispose) => {
    createComputed(() => order.push(`computed:${getConfig.numbers}`));
    const unsubscribe = configEvent.subscribe(({ key }) => {
      if (key !== "numbers") return;
      order.push(`listener:${getConfig.numbers}:${getMutableConfig().numbers}`);
    });

    setConfig("numbers", true, { nosave: true });

    unsubscribe();
    dispose();
  });

  expect(order).toEqual([
    "computed:false",
    "listener:true:true",
    "computed:true",
  ]);
});

it("leaves the previous array intact when an array value changes", () => {
  let previous: readonly unknown[] | undefined;
  const unsubscribe = configEvent.subscribe((event) => {
    if (event.key === "quoteLength") previous = event.previousValue;
  });
  const before = getMutableConfig().quoteLength;
  const snapshot = [...before];

  setConfig("quoteLength", [0, 1, 2, 3], { nosave: true });
  unsubscribe();

  expect(previous).toBe(before);
  expect(before).toEqual(snapshot);
  expect(getConfig.quoteLength).toEqual([0, 1, 2, 3]);
});
