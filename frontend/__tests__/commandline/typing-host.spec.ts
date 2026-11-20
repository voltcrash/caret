import { describe, expect, it, vi } from "vite-plus/test";

import {
  bindCommandlineTypingHost,
  blurTest,
  isTypingRouteActive,
  reloadPaceCaret,
  restartTest,
} from "../../src/ts/commandline/typing-host";

describe("commandline typing host", () => {
  it("does nothing while no typing host is bound", async () => {
    expect(isTypingRouteActive()).toBe(false);
    expect(() => restartTest()).not.toThrow();
    expect(() => blurTest()).not.toThrow();
    await expect(reloadPaceCaret()).resolves.toBeUndefined();
  });

  it("delegates to the bound host until it is released", async () => {
    const host = {
      restart: vi.fn(),
      isRouteActive: () => true,
      blur: vi.fn(),
      reloadPaceCaret: vi.fn(async () => undefined),
    };
    const release = bindCommandlineTypingHost(host);

    restartTest();
    blurTest();
    await reloadPaceCaret();

    expect(isTypingRouteActive()).toBe(true);
    expect(host.restart).toHaveBeenCalledOnce();
    expect(host.blur).toHaveBeenCalledOnce();
    expect(host.reloadPaceCaret).toHaveBeenCalledOnce();

    release();
    expect(isTypingRouteActive()).toBe(false);
  });
});
