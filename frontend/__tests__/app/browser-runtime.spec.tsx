vi.mock("../../src/app/font-runtime.client", () => ({
  FontRuntime: () => null,
}));
import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, expect, it, vi } from "vite-plus/test";

const state = vi.hoisted(() => ({
  load: vi.fn(async () => new Promise<void>(() => undefined)),
  init: vi.fn(async () => undefined),
  observe: vi.fn(),
  stop: vi.fn(),
  install: vi.fn(),
  restore: vi.fn(),
  activate: vi.fn(),
  deactivate: vi.fn(),
  disposeSentry: vi.fn(),
  version: vi.fn(),
  setVersion: vi.fn(),
  theme: vi.fn(),
}));
vi.mock("../../src/app/browser-integrity", () => ({ lockMath: vi.fn() }));
vi.mock("../../src/app/readiness", () => ({
  authReadiness: () => ({ state: () => ({ status: "ready" }) }),
}));
vi.mock("../../src/ts/auth-client", () => ({
  init: state.init,
  observeAuthSession: () => {
    state.observe();
    return state.stop;
  },
}));
vi.mock("../../src/ts/anim", () => ({ applyEngineSettings: vi.fn() }));
vi.mock("../../src/ts/config/lifecycle", () => ({
  loadFromLocalStorage: state.load,
}));
vi.mock("../../src/ts/cookies", () => ({
  getAcceptedCookies: () => ({}),
  activateWhatsAccepted: state.activate,
}));
vi.mock("../../src/ts/controllers/analytics-controller", () => ({
  deactivateAnalytics: state.deactivate,
}));
vi.mock("../../src/ts/sentry", () => ({ disposeSentry: state.disposeSentry }));
vi.mock("../../src/ts/controllers/theme-controller", async () => {
  const { configEvent } = await import("../../src/ts/events/config");
  return { useThemeEvents: () => configEvent.useListener(state.theme) };
});
vi.mock("../../src/ts/components/core/Theme", () => ({
  Theme: () => <div data-testid="theme" />,
}));
vi.mock("../../src/ts/components/core/ThemeEvents", () => ({
  ThemeEvents: () => null,
}));
vi.mock("../../src/ts/utils/logger", () => ({
  installLogger: () => {
    state.install();
    return state.restore;
  },
}));
vi.mock("../../src/ts/utils/version", () => ({
  fetchLatestVersion: state.version,
}));
vi.mock("../../src/ts/states/core", () => ({ setVersion: state.setVersion }));

import BrowserRuntime from "../../src/app/platform-runtime.client";
import { configEvent } from "../../src/ts/events/config";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("mounts without waiting for preferences/history and releases integrations before remount", async () => {
  const completions: ((value: { text: string; isNew: boolean }) => void)[] = [];
  state.version.mockImplementation(
    async () => new Promise((resolve) => completions.push(resolve)),
  );
  for (let i = 0; i < 2; i++) {
    const view = render(() => <BrowserRuntime />);
    expect(view.getByTestId("theme")).toBeInTheDocument();
    expect(state.init).not.toHaveBeenCalled();
    configEvent.dispatch({ key: "fullConfigChange" });
    expect(state.theme).toHaveBeenCalledTimes(i + 1);
    view.unmount();
    expect(state.stop).not.toHaveBeenCalled();
    expect(state.restore).toHaveBeenCalledTimes(i + 1);
    expect(state.disposeSentry).toHaveBeenCalledTimes(i + 1);
    configEvent.dispatch({ key: "fullConfigChange" });
    expect(state.theme).toHaveBeenCalledTimes(i + 1);
  }
  for (const finish of completions) finish({ text: "late", isNew: true });
  await Promise.resolve();
  await Promise.resolve();
  expect(state.setVersion).not.toHaveBeenCalled();
});
