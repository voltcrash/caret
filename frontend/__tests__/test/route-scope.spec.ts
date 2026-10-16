import { createComputed, createRoot, createSignal, onCleanup } from "solid-js";
import { beforeEach, afterEach, expect, it, vi } from "vite-plus/test";

import { mountApplication } from "../../src/app/application";
import {
  createTestApplication,
  releaseTestApplication,
} from "../__harness__/mock-application";
import {
  bindTypingActivity,
  captureTypingMount,
  captureTypingRoute,
  createTypingOwned,
  isTypingRouteActive,
  isTypingRouteTransitioning,
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
  expect(isTypingRouteActive()).toBe(false);
  expect(captureTypingMount().activate()).toBe(true);
  const previous = captureTypingRoute();
  expect(previous.isCurrent()).toBe(true);
  expect(() => mountTypingScope()).toThrow("already mounted");
  release();
  expect(previous.isCurrent()).toBe(false);
  expect(isTypingRouteActive()).toBe(false);
  const releaseNext = mountTypingScope();
  expect(captureTypingMount().activate()).toBe(true);
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

it("lets derived state observe mounts and the rollback binding", () => {
  const values: boolean[] = [];
  const stop = createRoot((dispose) => {
    createComputed(() => values.push(isTypingRouteActive()));
    return dispose;
  });
  const [page, setPage] = createSignal("test");
  const unbind = bindTypingActivity(() => page() === "test");
  setPage("settings");
  setPage("test");
  unbind();
  const release = mountTypingScope();
  expect(isTypingRouteActive()).toBe(false);
  captureTypingMount().activate();
  release();
  stop();
  expect(values).toEqual([true, true, false, true, true, false, true, false]);
});

it("reports rollback page fades but never transitions for the Start leaf", () => {
  let fading = true;
  const unbind = bindTypingActivity(
    () => true,
    () => fading,
  );
  expect(isTypingRouteTransitioning()).toBe(true);
  fading = false;
  expect(isTypingRouteTransitioning()).toBe(false);
  fading = true;
  const release = mountTypingScope();
  expect(isTypingRouteTransitioning()).toBe(false);
  release();
  unbind();
});

it("activates only the mount that waited for preferences", () => {
  const leave = mountTypingScope();
  const stale = captureTypingMount();
  leave();
  const release = mountTypingScope();
  expect(stale.activate()).toBe(false);
  expect(isTypingRouteActive()).toBe(false);
  expect(captureTypingMount().activate()).toBe(true);
  expect(isTypingRouteActive()).toBe(true);
  release();
  expect(stale.activate()).toBe(false);
});

it("rejects callbacks from a disposed application after another app mounts", () => {
  const leave = mountTypingScope();
  const entry = captureTypingMount();
  entry.activate();
  const lease = captureTypingRoute();
  dispose();
  const next = createTestApplication();
  const release = mountApplication(next.application);
  dispose = () => {
    release();
    next.dispose();
  };
  const leaveNext = mountTypingScope();
  captureTypingMount().activate();
  expect(entry.activate()).toBe(false);
  expect(lease.isCurrent()).toBe(false);
  leave();
  leaveNext();
});
