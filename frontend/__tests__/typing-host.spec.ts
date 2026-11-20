import { createRoot, createMemo } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import {
  bindTypingHost,
  blurTest,
  isTypingRouteActive,
  reloadPaceCaret,
  restartTest,
  updateTestHints,
} from "../src/ts/typing-host";

function host(): Parameters<typeof bindTypingHost>[0] {
  return {
    isRouteActive: () => true,
    restart: vi.fn(),
    blur: vi.fn(),
    reloadPaceCaret: vi.fn(async () => undefined),
    updateHints: vi.fn(),
    isNoQuitActive: () => false,
  };
}

describe("typing host", () => {
  it("does nothing while no typing route is bound", async () => {
    expect(isTypingRouteActive()).toBe(false);
    expect(() => restartTest()).not.toThrow();
    expect(() => blurTest()).not.toThrow();
    expect(() => updateTestHints()).not.toThrow();
    await expect(reloadPaceCaret()).resolves.toBeUndefined();
  });

  it("delegates to the bound route until it is released", async () => {
    const bound = host();
    const release = bindTypingHost(bound);

    restartTest();
    blurTest();
    await reloadPaceCaret();
    updateTestHints();

    expect(isTypingRouteActive()).toBe(true);
    expect(bound.updateHints).toHaveBeenCalledOnce();
    expect(bound.restart).toHaveBeenCalledOnce();
    expect(bound.blur).toHaveBeenCalledOnce();
    expect(bound.reloadPaceCaret).toHaveBeenCalledOnce();

    release();
    expect(isTypingRouteActive()).toBe(false);
  });

  it("lets derived state follow route mounts", () => {
    createRoot((dispose) => {
      const active = createMemo(isTypingRouteActive);
      expect(active()).toBe(false);
      const release = bindTypingHost(host());
      expect(active()).toBe(true);
      release();
      expect(active()).toBe(false);
      dispose();
    });
  });

  it("keeps a newer binding when an older one is released", () => {
    const releaseOld = bindTypingHost(host());
    const releaseNew = bindTypingHost({ ...host(), isRouteActive: () => true });
    releaseOld();
    expect(isTypingRouteActive()).toBe(true);
    releaseNew();
  });
});
