import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  let resolve = (): void => undefined;
  return {
    ready: new Promise<void>((done) => (resolve = done)),
    resolve: () => resolve(),
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
  preferencesReadiness: () => ({ wait: async () => mocks.ready }),
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
  isTestActive,
  setFocus,
  setResultVisible,
  setTestActive,
} from "../../../src/ts/states/test";
import {
  createTestApplication,
  releaseTestApplication,
} from "../../__harness__/mock-application";

releaseTestApplication();
let dispose: () => void;
beforeEach(() => {
  vi.clearAllMocks();
  const app = createTestApplication();
  const release = mountApplication(app.application);
  dispose = () => {
    release();
    app.dispose();
  };
});
afterEach(() => dispose());

it("starts a fresh test only after preferences and only for the current mount", async () => {
  const leave = mountTypingScope();
  const stale = enterTypingRoute();
  leave();
  const release = mountTypingScope();
  const current = enterTypingRoute();
  expect(mocks.restart).not.toHaveBeenCalled();
  mocks.resolve();
  await Promise.all([stale, current]);
  expect(mocks.restart).toHaveBeenCalledExactlyOnceWith({ noAnim: true });
  release();
});

it("tears down timers, funboxes and incomplete state synchronously on exit", () => {
  setTestActive(true);
  setResultVisible(true);
  setFocus(true);
  updateModifierState({ leftShift: true });
  exitTypingRoute();
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
