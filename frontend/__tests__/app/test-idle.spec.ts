import { afterEach, expect, it, vi } from "vite-plus/test";

import { waitForTestIdle } from "../../src/app/test-idle.client";
import { resetTypingLifecycle } from "../__harness__/typing-lifecycle";
afterEach(() => resetTypingLifecycle());

it("waits for restart, typing and result calculation to finish", async () => {
  resetTypingLifecycle("preparing.exiting");
  const done = vi.fn();
  const controller = new AbortController();
  const pending = waitForTestIdle(controller.signal).then(done);
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  resetTypingLifecycle("running");
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  resetTypingLifecycle("completing.loading");
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  resetTypingLifecycle("result");
  await pending;
  expect(done).toHaveBeenCalledOnce();
});

it("cancels pending preferences when their account lease ends", async () => {
  resetTypingLifecycle("running");
  const controller = new AbortController();
  const pending = waitForTestIdle(controller.signal);
  const rejected = expect(pending).rejects.toThrow("Account changed");
  controller.abort(new DOMException("Account changed", "AbortError"));
  await rejected;
});
