import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const env = vi.hoisted(() => ({ dev: false, profiler: false }));
vi.mock("../../src/ts/utils/env", () => ({ isDevEnvironment: () => env.dev }));
vi.mock("../../src/ts/utils/profiler-mode", () => ({
  isProfilerMode: () => env.profiler,
}));

import {
  installLogger,
  isDebugLogging,
  toggleDebugLogs,
} from "../../src/ts/utils/logger";

let uninstall: (() => void) | undefined;
afterEach(() => {
  uninstall?.();
  uninstall = undefined;
  env.dev = false;
  env.profiler = false;
  localStorage.removeItem("debugLogs");
});

describe("logger debug state", () => {
  it("reports whether debug output is enabled", () => {
    localStorage.setItem("debugLogs", "false");
    uninstall = installLogger();
    expect(isDebugLogging()).toBe(false);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    toggleDebugLogs();
    expect(isDebugLogging()).toBe(true);
    toggleDebugLogs();
    expect(isDebugLogging()).toBe(false);
    log.mockRestore();
  });

  it("enables debug output in development unless profiling", () => {
    env.dev = true;
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    uninstall = installLogger();
    expect(isDebugLogging()).toBe(true);
    uninstall();
    env.profiler = true;
    uninstall = installLogger();
    expect(isDebugLogging()).toBe(false);
    log.mockRestore();
  });
});
