import { resetTypingLifecycle } from "../../__harness__/typing-lifecycle";
import { isResultCalculating } from "../../../src/ts/states/test";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { getTypingLifecycle } from "../../../src/features/typing/lifecycle-controller";

const mocks = vi.hoisted(() => ({
  current: true,
  clear: vi.fn(),
  end: vi.fn(),
  complete: vi.fn(
    async (_failed: boolean, _lease: { isCurrent: () => boolean }) => undefined,
  ),
  fade: vi.fn(async () => undefined),
  present: vi.fn(async () => undefined),
  snapshot: vi.fn(() => ({})),
  prepare: vi.fn(async () => undefined),
}));
vi.mock("../../../src/features/typing/scope", () => ({
  captureTypingRoute: () => ({ isCurrent: () => mocks.current }),
}));
vi.mock("../../../src/ts/anim", () => ({ animateAsync: mocks.fade }));
vi.mock("../../../src/ts/states/test-dom", () => ({
  getTypingTestElement: () => document.createElement("div"),
}));
vi.mock("../../../src/ts/states/test", async () => ({
  ...(await import("../../../src/features/typing/lifecycle-controller"))
    .lifecycleSelectors,
  getBailedOut: () => false,
}));
vi.mock("../../../src/features/typing/runtime/completion-snapshot", () => ({
  captureCompletionSnapshot: mocks.snapshot,
}));
vi.mock("../../../src/ts/states/result", () => ({
  prepareResultScreen: mocks.prepare,
}));
vi.mock("../../../src/features/typing/runtime/test-ui", () => ({
  onTestFinish: vi.fn(),
}));
vi.mock("../../../src/features/typing/runtime/events/data", () => ({
  getTestSession: () => ({ end: mocks.end }),
  forceReleaseAllKeys: vi.fn(),
  cleanupData: vi.fn(),
}));
vi.mock("../../../src/features/typing/runtime/test-timer", () => ({
  clear: mocks.clear,
}));
vi.mock("../../../src/features/typing/runtime/completion.client", () => ({
  createCompletion: (_snapshot: unknown, failed: boolean) => ({
    build: async (lease: { isCurrent: () => boolean }) =>
      await mocks.complete(failed, lease),
    present: mocks.present,
    saved: async () => undefined,
  }),
}));

import {
  finish,
  retryCompletion,
} from "../../../src/features/typing/runtime/completion";

beforeEach(() => {
  resetTypingLifecycle("running");
  vi.clearAllMocks();
  mocks.current = true;
  mocks.complete.mockReset().mockResolvedValue(undefined);
  mocks.present.mockReset().mockResolvedValue(undefined);
  mocks.fade.mockReset().mockResolvedValue(undefined);
  mocks.prepare.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  resetTypingLifecycle("unmounted");
  vi.useRealTimers();
});

it("ignores finish before a test starts", async () => {
  resetTypingLifecycle("ready");
  await finish();
  expect(mocks.end).not.toHaveBeenCalled();
  expect(mocks.fade).not.toHaveBeenCalled();
  expect(isResultCalculating()).toBe(false);
});

it("releases the transition guard when completion rejects", async () => {
  mocks.complete.mockRejectedValueOnce(new Error("result failed"));
  await finish();
  expect(isResultCalculating()).toBe(false);
});

it("stops timing before any download/animation and ignores duplicate finishes", async () => {
  const fade = Promise.withResolvers<undefined>();
  mocks.fade.mockReturnValueOnce(fade.promise);
  const finished = finish(true);
  expect(mocks.clear).toHaveBeenCalledOnce();
  expect(mocks.end).toHaveBeenCalledWith(expect.any(Number));
  expect(isResultCalculating()).toBe(true);
  await finish();
  expect(mocks.end).toHaveBeenCalledOnce();
  expect(mocks.complete).not.toHaveBeenCalled();
  fade.resolve(undefined);
  await finished;

  expect(mocks.complete).toHaveBeenCalledWith(true, expect.any(Object));
});

it("does not render or save a result after the typing route unmounts", async () => {
  const fade = Promise.withResolvers<undefined>();
  mocks.fade.mockReturnValueOnce(fade.promise);
  const finished = finish();
  mocks.current = false;
  fade.resolve(undefined);
  await finished;
  expect(mocks.complete).not.toHaveBeenCalled();
});

it("retries result construction without ending or capturing the test again", async () => {
  mocks.complete.mockRejectedValueOnce(new Error("analysis failed"));
  await finish();
  expect(getTypingLifecycle().state().phase).toBe("error.completion");
  await retryCompletion();
  expect(getTypingLifecycle().state().phase).toBe("result");
  expect(mocks.end).toHaveBeenCalledOnce();
  expect(mocks.snapshot).toHaveBeenCalledOnce();
  expect(mocks.complete).toHaveBeenCalledTimes(2);
});

it("retries presentation without repeating result construction", async () => {
  mocks.present.mockRejectedValueOnce(new Error("chart failed"));
  await finish();
  expect(getTypingLifecycle().state().phase).toBe("error.completion");
  await Promise.all([retryCompletion(), retryCompletion()]);
  expect(mocks.complete).toHaveBeenCalledOnce();
  expect(mocks.present).toHaveBeenCalledTimes(2);
  expect(getTypingLifecycle().state().phase).toBe("result");
});

it("recovers a result-screen load failure with the original snapshot", async () => {
  mocks.prepare.mockRejectedValueOnce(new Error("chunk unavailable"));
  await finish();
  expect(mocks.complete).not.toHaveBeenCalled();
  await retryCompletion();
  expect(mocks.snapshot).toHaveBeenCalledOnce();
  expect(mocks.complete).toHaveBeenCalledOnce();
  expect(getTypingLifecycle().state().phase).toBe("result");
});

it("times out hung completion work and ignores its late continuation after restart", async () => {
  vi.useFakeTimers();
  const pending = Promise.withResolvers<undefined>();
  mocks.complete.mockReturnValueOnce(pending.promise);
  const finishing = finish();
  await vi.waitFor(() => expect(mocks.complete).toHaveBeenCalledOnce());
  await vi.advanceTimersByTimeAsync(15_000);
  await finishing;
  expect(getTypingLifecycle().state().phase).toBe("error.completion");
  const oldLease = mocks.complete.mock.calls[0]?.[1];
  resetTypingLifecycle("running");
  pending.resolve(undefined);
  await Promise.resolve();
  expect(oldLease?.isCurrent()).toBe(false);
  expect(mocks.present).not.toHaveBeenCalled();
  expect(getTypingLifecycle().state().phase).toBe("running");
});

it("claims finish before a synchronous native finish notification repeats it", async () => {
  mocks.end.mockImplementationOnce(() => {
    void finish();
  });
  await finish();
  expect(mocks.end).toHaveBeenCalledOnce();
  expect(mocks.complete).toHaveBeenCalledOnce();
});
