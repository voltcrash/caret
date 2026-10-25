import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const state = vi.hoisted(() => ({
  restarting: false,
  calculating: false,
  active: false,
  noQuit: false,
  notice: vi.fn(),
}));
// Reactive stand-ins: transitionSettled tracks these through an effect.
const transitions = vi.hoisted(async () => {
  const { createSignal } = await import("solid-js");
  const [restarting, setRestarting] = createSignal(false);
  const [calculating, setCalculating] = createSignal(false);
  return { restarting, setRestarting, calculating, setCalculating };
});

vi.mock("../../src/ts/states/test", async () => {
  const signals = await transitions;
  return {
    isTestRestarting: () => signals.restarting() || state.restarting,
    isResultCalculating: () => signals.calculating() || state.calculating,
    isTestActive: () => state.active,
  };
});
vi.mock("../../src/features/typing/runtime/session.client", () => ({
  isNoQuitActive: () => state.noQuit,
}));
vi.mock("../../src/ts/states/notifications", () => ({
  showNoticeNotification: state.notice,
}));

import {
  canNavigate,
  transitionSettled,
} from "../../src/app/navigation-guard.client";

describe("navigation guard", () => {
  beforeEach(async () => {
    Object.assign(state, {
      restarting: false,
      calculating: false,
      active: false,
      noQuit: false,
    });
    state.notice.mockClear();
    const signals = await transitions;
    signals.setRestarting(false);
    signals.setCalculating(false);
  });

  it.each(["restarting", "calculating"] as const)(
    "blocks while %s, except forced navigation",
    (key) => {
      state[key] = true;
      expect(canNavigate()).toBe(false);
      expect(canNavigate({ force: true })).toBe(true);
    },
  );

  it("blocks an active no-quit test even when forced", () => {
    state.active = state.noQuit = true;
    expect(canNavigate({ force: true })).toBe(false);
    expect(state.notice).toHaveBeenCalledWith(
      "No quit funbox is active. Please finish the test.",
      { important: true },
    );
  });

  it("allows normal active tests and completed no-quit tests", () => {
    state.active = true;
    expect(canNavigate()).toBe(true);
    state.active = false;
    state.noQuit = true;
    expect(canNavigate()).toBe(true);
    expect(state.notice).not.toHaveBeenCalled();
  });

  it("waits for a restart to finish instead of refusing navigation", async () => {
    const signals = await transitions;
    signals.setRestarting(true);
    const waiting = transitionSettled();
    const pending = Symbol("pending");
    expect(await Promise.race([waiting, Promise.resolve(pending)])).toBe(
      pending,
    );
    signals.setRestarting(false);
    await waiting;
    expect(canNavigate()).toBe(true);
  });

  it("stops waiting after the timeout", async () => {
    const signals = await transitions;
    signals.setCalculating(true);
    await transitionSettled(10);
    expect(canNavigate()).toBe(false);
  });
});
