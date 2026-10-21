import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  return {
    preferences: vi.fn(async () => undefined),
    restart: vi.fn(async () => undefined),
    timerClear: vi.fn(),
    paceReset: vi.fn(),
    pauseReplay: vi.fn(),
    sessionReset: vi.fn(),
    funboxClear: vi.fn(async () => undefined),
    clearGlobal: vi.fn(),
    layoutfluidHide: vi.fn(),
    altGrReset: vi.fn(),
  };
});
vi.mock("../../../src/app/readiness", () => ({
  preferencesReadiness: () => ({ wait: mocks.preferences }),
}));
vi.mock("../../../src/features/typing/runtime/test-logic", () => ({
  restart: mocks.restart,
}));
vi.mock("../../../src/features/typing/runtime/test-timer", () => ({
  clear: mocks.timerClear,
}));
vi.mock("../../../src/features/typing/runtime/pace-caret", () => ({
  reset: mocks.paceReset,
}));
vi.mock("../../../src/features/typing/runtime/replay", () => ({
  pauseReplay: mocks.pauseReplay,
}));
vi.mock("../../../src/features/typing/runtime/events/data", () => ({
  getTestSession: () => ({ reset: mocks.sessionReset }),
}));
vi.mock("../../../src/features/typing/runtime/funbox/funbox", () => ({
  clear: mocks.funboxClear,
}));
vi.mock("../../../src/features/typing/runtime/funbox/list", () => ({
  getActiveFunboxesWithFunction: () => [
    { functions: { clearGlobal: mocks.clearGlobal } },
  ],
}));
vi.mock(
  "../../../src/features/typing/runtime/funbox/layoutfluid-funbox-timer",
  () => ({ instantHide: mocks.layoutfluidHide }),
);
vi.mock("../../../src/features/typing/runtime/layout-emulator", () => ({
  resetAltGrState: mocks.altGrReset,
}));

import { mountApplication } from "../../../src/app/application";
import { isTypingReady, setTypingReady } from "../../../src/app/startup";
import {
  enterTypingRoute,
  exitTypingRoute,
} from "../../../src/features/typing/lifecycle";
import { mountTypingScope } from "../../../src/features/typing/scope";
import {
  getModifierState,
  updateModifierState,
} from "../../../src/ts/states/modifiers";
import {
  getFocus,
  getResultVisible,
  getTestInitError,
  isTestActive,
  isTestRestarting,
  setFocus,
  setResultVisible,
  setTestActive,
  setIsTestRestarting,
} from "../../../src/ts/states/test";
import {
  createTestApplication,
  releaseTestApplication,
} from "../../__harness__/mock-application";

releaseTestApplication();
let dispose: () => void;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.preferences.mockReset().mockResolvedValue(undefined);
  mocks.restart.mockReset().mockResolvedValue(undefined);
  const app = createTestApplication();
  const release = mountApplication(app.application);
  dispose = () => {
    release();
    app.dispose();
  };
});
afterEach(() => dispose());

it("starts a fresh test only after preferences and only for the current mount", async () => {
  const preferences = Promise.withResolvers<undefined>();
  mocks.preferences.mockReturnValue(preferences.promise);
  const leave = mountTypingScope();
  const stale = enterTypingRoute();
  leave();
  const release = mountTypingScope();
  const current = enterTypingRoute();
  expect(mocks.restart).not.toHaveBeenCalled();
  expect(isTypingReady()).toBe(false);
  preferences.resolve(undefined);
  await Promise.all([stale, current]);
  expect(mocks.restart).toHaveBeenCalledExactlyOnceWith({ noAnim: true });
  expect(isTypingReady()).toBe(true);
  release();
});

it("keeps startup pending until the first test finishes initializing", async () => {
  const initialization = Promise.withResolvers<undefined>();
  mocks.restart.mockReturnValueOnce(initialization.promise);
  const release = mountTypingScope();
  const entered = enterTypingRoute();
  await Promise.resolve();
  expect(mocks.restart).toHaveBeenCalledOnce();
  expect(isTypingReady()).toBe(false);
  initialization.resolve(undefined);
  await entered;
  expect(isTypingReady()).toBe(true);
  release();
});

it.each(["resolve", "reject"] as const)(
  "ignores a stale initialization that %ss while its replacement is pending",
  async (outcome) => {
    const oldTest = Promise.withResolvers<undefined>();
    const newTest = Promise.withResolvers<undefined>();
    mocks.restart
      .mockReturnValueOnce(oldTest.promise)
      .mockReturnValueOnce(newTest.promise);
    const leave = mountTypingScope();
    const stale = enterTypingRoute();
    await Promise.resolve();
    leave();
    const release = mountTypingScope();
    const current = enterTypingRoute();
    await Promise.resolve();
    if (outcome === "reject") {
      const failed = expect(stale).rejects.toThrow("stale initialization");
      oldTest.reject(new Error("stale initialization"));
      await failed;
    } else {
      oldTest.resolve(undefined);
      await stale;
    }
    expect(isTypingReady()).toBe(false);
    expect(getTestInitError()).toBeNull();
    newTest.resolve(undefined);
    await current;
    expect(isTypingReady()).toBe(true);
    release();
  },
);

it.each(["preferences", "restart"] as const)(
  "reveals an initialization error when %s fails",
  async (stage) => {
    mocks[stage].mockRejectedValueOnce(new Error("startup failed"));
    const release = mountTypingScope();
    setIsTestRestarting(true);
    await expect(enterTypingRoute()).rejects.toThrow("startup failed");
    expect(isTypingReady()).toBe(true);
    expect(getTestInitError()).toEqual({ message: "startup failed" });
    expect(isTestRestarting()).toBe(false);
    release();
  },
);

it("tears down timers, funboxes and incomplete state synchronously on exit", () => {
  setTestActive(true);
  setResultVisible(true);
  setFocus(true);
  updateModifierState({ leftShift: true });
  setTypingReady(true);
  exitTypingRoute();
  expect(isTypingReady()).toBe(false);
  expect(mocks.timerClear).toHaveBeenCalledOnce();
  expect(mocks.paceReset).toHaveBeenCalledOnce();
  expect(mocks.pauseReplay).toHaveBeenCalledOnce();
  expect(mocks.sessionReset).toHaveBeenCalledOnce();
  expect(mocks.clearGlobal).toHaveBeenCalledOnce();
  expect(mocks.funboxClear).toHaveBeenCalledOnce();
  expect(mocks.layoutfluidHide).toHaveBeenCalledOnce();
  expect(mocks.altGrReset).toHaveBeenCalledOnce();
  expect(isTestActive()).toBe(false);
  expect(getResultVisible()).toBe(false);
  expect(getFocus()).toBe(false);
  expect(getModifierState().shift).toBe(false);
  expect(mocks.restart).not.toHaveBeenCalled();
});
