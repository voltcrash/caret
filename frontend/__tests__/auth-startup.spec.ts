import { expect, it, vi } from "vite-plus/test";

const services = vi.hoisted(() => ({
  snapshot: vi.fn(),
  presets: vi.fn(),
  tags: vi.fn(),
  config: vi.fn(),
}));
vi.mock("../src/ts/db", () => ({ initSnapshot: services.snapshot }));
vi.mock("../src/ts/collections/presets", () => ({
  waitForPresetsReady: services.presets,
}));
vi.mock("../src/ts/collections/tags", () => ({
  waitForTagsReady: services.tags,
}));
vi.mock("../src/ts/collections/custom-themes", () => ({
  startCustomThemesSync: vi.fn(),
}));
vi.mock("../src/ts/collections/results", () => ({
  refetchResults: vi.fn(async () => undefined),
}));
vi.mock("../src/ts/config/remote", () => ({
  updateFromServer: services.config,
}));
vi.mock("../src/ts/sentry", () => ({ setUser: vi.fn() }));

it("starts account dependencies together and waits for all before publishing the snapshot", async () => {
  const releases: (() => void)[] = [];
  for (const request of Object.values(services)) {
    request.mockImplementation(
      async () =>
        new Promise<void>((resolve) => {
          releases.push(resolve);
        }),
    );
  }
  const { loadUser } = await import("../src/ts/auth");
  const { authEvent } = await import("../src/ts/events/auth");
  const dispatch = vi.spyOn(authEvent, "dispatch");
  services.snapshot.mockImplementation(
    async () =>
      new Promise((resolve) => {
        releases.push(() => resolve({ uid: "user", name: "User" }));
      }),
  );
  const loading = loadUser({
    uid: "user",
    email: "user@example.test",
    displayName: "User",
    providerData: [],
  });
  await vi.waitFor(() => expect(releases).toHaveLength(4));
  releases[0]?.();
  await Promise.resolve();
  expect(dispatch).not.toHaveBeenCalled();
  for (const release of releases.slice(1)) release();
  await loading;
  expect(dispatch).toHaveBeenCalledWith({
    type: "snapshotUpdated",
    data: { isInitial: true },
  });
});
