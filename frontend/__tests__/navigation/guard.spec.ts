import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const state = vi.hoisted(() => ({
  restarting: false,
  calculating: false,
  active: false,
  noQuit: false,
  notice: vi.fn(),
}));

vi.mock("../../src/ts/states/test", () => ({
  isTestRestarting: () => state.restarting,
  isResultCalculating: () => state.calculating,
  isTestActive: () => state.active,
}));
vi.mock("../../src/ts/test/funbox/list", () => ({
  isFunboxActive: () => state.noQuit,
}));
vi.mock("../../src/ts/states/notifications", () => ({
  showNoticeNotification: state.notice,
}));

import { canNavigate } from "../../src/ts/navigation/guard";

describe("navigation guard", () => {
  beforeEach(() => {
    Object.assign(state, {
      restarting: false,
      calculating: false,
      active: false,
      noQuit: false,
    });
    state.notice.mockClear();
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
});
