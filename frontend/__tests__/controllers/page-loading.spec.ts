import { beforeEach, expect, it, vi } from "vite-plus/test";

const { progress, text, transition, results } = vi.hoisted(() => ({
  progress: vi.fn<(percentage: number, duration: number) => Promise<void>>(),
  text: vi.fn<(message: string) => void>(),
  transition: vi.fn(),
  results: vi.fn(),
}));

vi.mock("../../src/ts/pages/test", async () => {
  const { default: Page } = await import("../../src/ts/pages/page");
  return { page: new Page({ id: "test", path: "/" }) };
});
vi.mock("../../src/ts/pages/loading", async () => {
  const { default: Page } = await import("../../src/ts/pages/page");
  return {
    page: new Page({ id: "loading", path: "/" }),
    updateBar: progress,
    updateText: text,
    showBar: async () => undefined,
    showSpinner: vi.fn(),
    showError: vi.fn(),
  };
});
vi.mock("../../src/ts/states/page-transition", () => ({
  get: () => false,
  set: vi.fn(),
  preparePage: vi.fn(),
  activatePage: vi.fn(),
  transitionPage: transition,
}));
vi.mock("../../src/ts/components/pages/lazy-pages", () => ({
  preloadPage: async () => undefined,
}));
vi.mock("../../src/ts/collections/results", () => ({
  isResultsReady: () => false,
  waitForResultsReady: results,
}));
vi.mock("../../src/ts/db", () => ({ getSnapshot: () => ({}) }));
vi.mock("../../src/ts/states/server-configuration", () => ({
  configurationPromise: Promise.resolve(),
}));
vi.mock("../../src/features/typing/runtime/today-tracker", () => ({
  addAllFromToday: vi.fn(),
}));
vi.mock("../../src/features/typing/runtime/focus", () => ({ set: vi.fn() }));
vi.mock("../../src/ts/utils/misc", () => ({
  applyReducedMotion: (duration: number) => duration,
}));

import { change } from "../../src/ts/controllers/page-controller";
import { setAppLoading } from "../../src/ts/states/app";
import { setActivePage } from "../../src/ts/states/core";

beforeEach(() => {
  vi.clearAllMocks();
  progress.mockResolvedValue();
  transition.mockResolvedValue(undefined);
  results.mockResolvedValue(undefined);
  setActivePage("test");
  setAppLoading(false);
});

it("keeps combined user-data and results stages moving forward", async () => {
  await change("account", {
    loadingOptions: {
      loadingMode: () => "sync",
      loadingPromise: async () => undefined,
      style: "bar",
      keyframes: [
        { percentage: 90, durationMs: 1000, text: "Downloading user data..." },
      ],
    },
  });
  expect(progress.mock.calls.map(([percentage]) => percentage)).toEqual([
    0, 45, 50, 50, 95, 100,
  ]);
  expect(text.mock.calls.map(([message]) => message)).toEqual([
    "",
    "Downloading user data...",
    "Downloading results...",
  ]);
});

it("completes progress instantly before fading out the loading page", async () => {
  const completion = Promise.withResolvers<undefined>();
  const filling = Promise.withResolvers<undefined>();
  progress.mockImplementation(async (percentage, duration) => {
    if (percentage === 100 && duration === 0) {
      filling.resolve(undefined);
      await completion.promise;
    }
  });
  const navigation = change("account");
  await filling.promise;
  expect(transition).not.toHaveBeenCalledWith("loading", false, 125);
  completion.resolve(undefined);
  await navigation;
  expect(transition).toHaveBeenCalledWith("loading", false, 125);
});

it("skips fades hidden behind the startup screen", async () => {
  setAppLoading(true);
  await change("account");
  expect(transition).toHaveBeenCalledWith("loading", false, 0);
  expect(transition).toHaveBeenCalledWith("account", true, 0);
  expect(transition).not.toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    125,
  );
});
