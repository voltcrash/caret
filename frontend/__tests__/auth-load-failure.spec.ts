import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const services = vi.hoisted(() => ({
  snapshot: vi.fn(),
  signOut: vi.fn(async () => undefined),
}));
vi.mock("../src/ts/db", () => ({ initSnapshot: services.snapshot }));
vi.mock("../src/ts/collections/presets", () => ({
  waitForPresetsReady: vi.fn(async () => undefined),
}));
vi.mock("../src/ts/collections/tags", () => ({
  waitForTagsReady: vi.fn(async () => undefined),
}));
vi.mock("../src/ts/collections/custom-themes", () => ({
  startCustomThemesSync: vi.fn(),
}));
vi.mock("../src/ts/collections/results", () => ({
  refetchResults: vi.fn(async () => undefined),
}));
vi.mock("../src/ts/config/remote", () => ({
  updateFromServer: vi.fn(async () => undefined),
}));
vi.mock("../src/ts/sentry", () => ({ setUser: vi.fn() }));
vi.mock("../src/ts/auth-client", async (original) => ({
  ...(await original<typeof import("../src/ts/auth-client")>()),
  isAuthAvailable: () => true,
  getAuthenticatedUser: () => ({ uid: "user" }),
  signOut: services.signOut,
}));

import { loadUser } from "../src/ts/auth";
import { SnapshotInitError } from "../src/ts/utils/snapshot-init-error";

const user = {
  uid: "user",
  email: "user@example.test",
  displayName: "User",
  providerData: [],
};

describe("account load failures", () => {
  beforeEach(() => {
    services.snapshot.mockReset();
    services.signOut.mockClear();
  });

  it.each([
    [
      "network loss",
      new Error("Could not fetch configuration: Failed to fetch"),
    ],
    [
      "server error",
      new SnapshotInitError("Internal Server Error (user)", 500),
    ],
    ["rate limit", new SnapshotInitError("Too many requests (user)", 429)],
    [
      "timeout",
      new SnapshotInitError("request took too long to complete", 500),
    ],
  ])("keeps the session after a %s", async (_name, error) => {
    services.snapshot.mockRejectedValue(error);
    await expect(loadUser(user)).resolves.toBe("unavailable");
    expect(services.signOut).not.toHaveBeenCalled();
  });

  it.each([
    ["revoked session", new SnapshotInitError("Unauthorized (user)", 401)],
    ["disabled account", new SnapshotInitError("Account disabled (user)", 403)],
  ])("signs out after a %s", async (_name, error) => {
    services.snapshot.mockRejectedValue(error);
    await expect(loadUser(user)).resolves.toBe("unauthenticated");
    expect(services.signOut).toHaveBeenCalledOnce();
  });

  it("signs out when the snapshot reports missing authentication", async () => {
    services.snapshot.mockResolvedValue(false);
    await expect(loadUser(user)).resolves.toBe("unauthenticated");
    expect(services.signOut).toHaveBeenCalledOnce();
  });

  it("publishes a loaded account", async () => {
    services.snapshot.mockResolvedValue({ uid: "user", name: "User" });
    await expect(loadUser(user)).resolves.toBe("loaded");
    expect(services.signOut).not.toHaveBeenCalled();
  });
});
