import { afterEach, expect, it, vi } from "vite-plus/test";

import { waitForTestIdle } from "../../src/app/test-idle.client";
import {
  setTestActive,
  setIsTestRestarting,
  setResultCalculating,
} from "../../src/ts/states/test";

afterEach(() => {
  setTestActive(false);
  setIsTestRestarting(false);
  setResultCalculating(false);
});

it("waits for restart, typing and result calculation to finish", async () => {
  setIsTestRestarting(true);
  const done = vi.fn();
  const controller = new AbortController();
  const pending = waitForTestIdle(controller.signal).then(done);
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  setTestActive(true);
  setIsTestRestarting(false);
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  setResultCalculating(true);
  setTestActive(false);
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  setResultCalculating(false);
  await pending;
  expect(done).toHaveBeenCalledOnce();
});

it("cancels pending preferences when their account lease ends", async () => {
  setTestActive(true);
  const controller = new AbortController();
  const pending = waitForTestIdle(controller.signal);
  const rejected = expect(pending).rejects.toThrow("Account changed");
  controller.abort(new DOMException("Account changed", "AbortError"));
  await rejected;
});
