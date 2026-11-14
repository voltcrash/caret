import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { canPrefetch } from "../../src/app/network.client";

afterEach(() => vi.unstubAllGlobals());

describe("speculative downloads", () => {
  it.each(["slow-2g", "2g", "3g"])("skips prefetch on %s", (effectiveType) => {
    vi.stubGlobal("navigator", { onLine: true, connection: { effectiveType } });
    expect(canPrefetch()).toBe(false);
  });
  it("honors data saver even on a fast connection", () => {
    vi.stubGlobal("navigator", {
      onLine: true,
      connection: { effectiveType: "4g", saveData: true },
    });
    expect(canPrefetch()).toBe(false);
  });
  it("skips prefetch while offline", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(canPrefetch()).toBe(false);
  });
  it("preserves prefetch without network information support", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(canPrefetch()).toBe(true);
  });
  it("checks the current connection each time", () => {
    const connection = { effectiveType: "3g" };
    vi.stubGlobal("navigator", { onLine: true, connection });
    expect(canPrefetch()).toBe(false);
    connection.effectiveType = "4g";
    expect(canPrefetch()).toBe(true);
  });
});
