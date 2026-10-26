import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createWorkerd } from "./workerd";

describe("production placement response metadata", () => {
  let mf: Awaited<ReturnType<typeof createWorkerd>>;
  beforeAll(async () => {
    mf = await createWorkerd(false, undefined, false, {
      PLACEMENT_MODE: "smart",
    });
  });
  afterAll(async () => await mf?.dispose());

  it("exposes a valid placement decision without losing response policies", async () => {
    const response = await mf.dispatchFetch("http://localhost:3000/api", {
      headers: { "cf-placement": "remote-SIN" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Caret-Placement")).toBe("remote-SIN");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Request-Id")).not.toBeNull();
  });

  it.each([undefined, "remote-SIN?token=private"])(
    "omits absent or invalid placement (%s)",
    async (placement) => {
      const response = await mf.dispatchFetch("http://localhost:3000/api", {
        headers: placement === undefined ? {} : { "cf-placement": placement },
      });
      expect(response.status).toBe(200);
      expect(response.headers.has("X-Caret-Placement")).toBe(false);
    },
  );
});
