import { onCleanup } from "solid-js";
import { beforeEach, afterEach, expect, it, vi } from "vite-plus/test";

import { mountApplication } from "../../src/app/application";
import {
  createTestApplication,
  releaseTestApplication,
} from "../__harness__/mock-application";
import {
  captureTypingRoute,
  createTypingOwned,
  isTypingRouteActive,
  mountTypingScope,
} from "../../src/features/typing/scope";

releaseTestApplication();
let dispose: () => void;
beforeEach(() => {
  const app = createTestApplication();
  const release = mountApplication(app.application);
  dispose = () => {
    release();
    app.dispose();
  };
});
afterEach(() => dispose());

it("invalidates pending work before remount and rejects duplicate owners", () => {
  const release = mountTypingScope();
  const previous = captureTypingRoute();
  expect(previous.isCurrent()).toBe(true);
  expect(() => mountTypingScope()).toThrow("already mounted");
  release();
  expect(previous.isCurrent()).toBe(false);
  expect(isTypingRouteActive()).toBe(false);
  const releaseNext = mountTypingScope();
  expect(previous.isCurrent()).toBe(false);
  expect(captureTypingRoute().isCurrent()).toBe(true);
  release();
  expect(isTypingRouteActive()).toBe(true);
  releaseNext();
});

it("recreates timers/subscriptions per mount and cleans each exactly once", () => {
  const cleanup = vi.fn();
  const create = vi.fn(() => {
    onCleanup(cleanup);
    return {};
  });
  const resource = createTypingOwned(create);
  const first = mountTypingScope();
  const value = resource();
  expect(resource()).toBe(value);
  first();
  expect(cleanup).toHaveBeenCalledTimes(1);
  const second = mountTypingScope();
  expect(resource()).not.toBe(value);
  expect(create).toHaveBeenCalledTimes(2);
  second();
  second();
  expect(cleanup).toHaveBeenCalledTimes(2);
});
