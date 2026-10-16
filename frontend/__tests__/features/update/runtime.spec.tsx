vi.mock("../../../src/ts/utils/env", () => ({ isDevEnvironment: () => false }));
import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { clientBuildId, staleClient } from "../../../src/app/release";
import { UpdateRuntime } from "../../../src/features/update/runtime.client";

function deployed(version: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ version })),
  );
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("update runtime", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("treats a failed chunk as stale only when another build is deployed", async () => {
    render(() => <UpdateRuntime reload={vi.fn()} />);
    expect(clientBuildId).toBe("TESTING");
    deployed(clientBuildId);
    window.dispatchEvent(new Event("vite:preloadError"));
    await settle();
    // Same build: a network failure, not a stale tab.
    expect(staleClient()).toBeUndefined();
    deployed("newer-build");
    window.dispatchEvent(new Event("vite:preloadError"));
    await settle();
    expect(staleClient()).toBe("chunk");
  });

  it("checks the deployment after a failed dynamic import only", async () => {
    render(() => <UpdateRuntime reload={vi.fn()} />);
    deployed("newer-build");
    const unrelated = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(unrelated, "reason", { value: new Error("boom") });
    window.dispatchEvent(unrelated);
    await settle();
    expect(fetch).not.toHaveBeenCalled();
    const event = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(event, "reason", {
      value: new TypeError(
        "Failed to fetch dynamically imported module: /assets/old.js",
      ),
    });
    window.dispatchEvent(event);
    await settle();
    expect(fetch).toHaveBeenCalledWith("/version.json", { cache: "no-store" });
  });
});
