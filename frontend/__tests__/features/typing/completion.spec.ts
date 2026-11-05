import { beforeEach, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  current: true,
  active: true,
  calculating: false,
  clear: vi.fn(),
  end: vi.fn(),
  complete: vi.fn(async () => undefined),
  fade: vi.fn(async () => undefined),
  loading: vi.fn(),
}));
vi.mock("../../../src/features/typing/scope", () => ({
  captureTypingRoute: () => ({ isCurrent: () => mocks.current }),
}));
vi.mock("../../../src/ts/anim", () => ({ animateAsync: mocks.fade }));
vi.mock("../../../src/ts/states/test-dom", () => ({
  getTypingTestElement: () => document.createElement("div"),
}));
vi.mock("../../../src/ts/states/test", () => ({
  isTestActive: () => mocks.active,
  getBailedOut: () => false,
  isResultCalculating: () => mocks.calculating,
  setResultCalculating: (value: boolean) => {
    mocks.calculating = value;
  },
  setResultLoading: mocks.loading,
}));
vi.mock("../../../src/features/typing/runtime/events/data", () => ({
  getTestSession: () => ({ end: mocks.end }),
}));
vi.mock("../../../src/features/typing/runtime/test-timer", () => ({
  clear: mocks.clear,
}));
vi.mock("../../../src/features/typing/runtime/completion.client", () => ({
  finish: mocks.complete,
}));

import { finish } from "../../../src/features/typing/runtime/completion";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.current = true;
  mocks.active = true;
  mocks.calculating = false;
});

it("ignores finish before a test starts", async () => {
  mocks.active = false;
  await finish();
  expect(mocks.end).not.toHaveBeenCalled();
  expect(mocks.fade).not.toHaveBeenCalled();
  expect(mocks.calculating).toBe(false);
});

it.fails("releases the transition guard when completion rejects", async () => {
  mocks.complete.mockRejectedValueOnce(new Error("result failed"));
  await finish();
  expect(mocks.calculating).toBe(false);
});

it("stops timing before any download/animation and ignores duplicate finishes", async () => {
  const fade = Promise.withResolvers<undefined>();
  mocks.fade.mockReturnValueOnce(fade.promise);
  const finished = finish(true);
  expect(mocks.clear).toHaveBeenCalledOnce();
  expect(mocks.end).toHaveBeenCalledWith(expect.any(Number));
  expect(mocks.calculating).toBe(true);
  await finish();
  expect(mocks.end).toHaveBeenCalledOnce();
  expect(mocks.complete).not.toHaveBeenCalled();
  fade.resolve(undefined);
  await finished;
  expect(mocks.loading).toHaveBeenCalledWith(true);
  expect(mocks.complete).toHaveBeenCalledWith(true, expect.any(Object));
});

it("does not render or save a result after the typing route unmounts", async () => {
  const fade = Promise.withResolvers<undefined>();
  mocks.fade.mockReturnValueOnce(fade.promise);
  const finished = finish();
  mocks.current = false;
  fade.resolve(undefined);
  await finished;
  expect(mocks.loading).not.toHaveBeenCalled();
  expect(mocks.complete).not.toHaveBeenCalled();
});
