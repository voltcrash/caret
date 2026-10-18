vi.mock("../../src/app/font-runtime.client", () => ({
  FontRuntime: () => null,
}));
import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, expect, it, vi } from "vite-plus/test";

const state = vi.hoisted(() => ({
  load: vi.fn(async () => new Promise<void>(() => undefined)),
  install: vi.fn(),
  restore: vi.fn(),
  activate: vi.fn(),
  deactivate: vi.fn(),
  disposeSentry: vi.fn(),
  theme: vi.fn(),
}));
vi.mock("../../src/app/browser-integrity", () => ({ lockMath: vi.fn() }));
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
vi.mock("../../src/ts/sentry", () => ({
  disposeSentry: state.disposeSentry,
  toggleDebug: vi.fn(),
}));
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
  toggleDebugLogs: vi.fn(),
}));

import BrowserRuntime from "../../src/app/platform-runtime.client";
import { configEvent } from "../../src/ts/events/config";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("mounts without waiting for preferences and releases integrations before remount", () => {
  for (let i = 0; i < 2; i++) {
    const view = render(() => <BrowserRuntime />);
    expect(view.getByTestId("theme")).toBeInTheDocument();
    configEvent.dispatch({ key: "fullConfigChange" });
    expect(state.theme).toHaveBeenCalledTimes(i + 1);
    expect(Reflect.has(window, "toggleDebugLogs")).toBe(true);
    view.unmount();
    expect(Reflect.has(window, "toggleDebugLogs")).toBe(false);
    expect(state.restore).toHaveBeenCalledTimes(i + 1);
    expect(state.disposeSentry).toHaveBeenCalledTimes(i + 1);
    configEvent.dispatch({ key: "fullConfigChange" });
    expect(state.theme).toHaveBeenCalledTimes(i + 1);
  }
});
