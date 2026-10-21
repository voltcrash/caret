import { createRoot, createSignal, type Accessor, type Setter } from "solid-js";
import { afterEach, beforeEach, expect, it } from "vite-plus/test";

import { mountApplication } from "../../src/app/application";
import {
  createStartupReveal,
  setChromeReady,
  setStartupFinished,
  setTypingReady,
} from "../../src/app/startup";
import {
  createTestApplication,
  releaseTestApplication,
} from "../__harness__/mock-application";

releaseTestApplication();
let ready: Accessor<boolean>;
let setTyping: Setter<boolean>;
let dispose: () => void;
beforeEach(() => {
  const app = createTestApplication();
  const release = mountApplication(app.application);
  const root = createRoot((dispose) => {
    const [typing, setTyping] = createSignal(true);
    return { ready: createStartupReveal(typing), setTyping, dispose };
  });
  ready = root.ready;
  setTyping = root.setTyping;
  dispose = () => {
    root.dispose();
    release();
    app.dispose();
  };
});
afterEach(() => dispose());

it.each(["chrome", "typing"] as const)(
  "keeps the cover until both are ready when %s finishes first",
  (first) => {
    expect(ready()).toBe(false);
    if (first === "chrome") setChromeReady(true);
    else setTypingReady(true);
    expect(ready()).toBe(false);
    setChromeReady(true);
    setTypingReady(true);
    expect(ready()).toBe(true);
  },
);

it("reveals other routes without waiting for a typing test", () => {
  setTyping(false);
  expect(ready()).toBe(false);
  setChromeReady(true);
  expect(ready()).toBe(true);
});

it("releases the cover when navigation leaves a pending typing route", () => {
  setChromeReady(true);
  expect(ready()).toBe(false);
  setTyping(false);
  expect(ready()).toBe(true);
});

it("does not hide the app again during the fade, navigation or a restart", () => {
  setTypingReady(true);
  setChromeReady(true);
  expect(ready()).toBe(true);
  setTypingReady(false);
  setChromeReady(false);
  setTyping(false);
  setTyping(true);
  expect(ready()).toBe(true);
});

it("keeps a remounted layout visible after startup has finished", () => {
  setStartupFinished(true);
  expect(ready()).toBe(true);
});
