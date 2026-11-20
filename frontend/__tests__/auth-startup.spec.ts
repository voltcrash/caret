import { expect, it, vi } from "vite-plus/test";

const services = vi.hoisted(() => ({
  snapshot: vi.fn(),
  presets: vi.fn(),
  tags: vi.fn(),
  config: vi.fn(),
}));
const showModal = vi.hoisted(() => vi.fn());
vi.mock("../src/ts/db", () => ({ initSnapshot: services.snapshot }));
vi.mock("../src/data/collections/presets", () => ({
  waitForPresetsReady: services.presets,
}));
vi.mock("../src/data/collections/tags", () => ({
  waitForTagsReady: services.tags,
}));
vi.mock("../src/data/collections/custom-themes", () => ({
  startCustomThemesSync: vi.fn(),
}));
vi.mock("../src/data/collections/results", () => ({
  refetchResults: vi.fn(async () => undefined),
}));
vi.mock("../src/ts/config/remote", () => ({
  updateFromServer: services.config,
}));
vi.mock("../src/ts/sentry", () => ({ setUser: vi.fn() }));
vi.mock("../src/ts/states/modals", () => ({ showModal }));

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
  const { setLastSignedOutResult } = await import("../src/ts/states/test");
  // A guest result waiting to be saved is offered once the account loads.
  setLastSignedOutResult({} as Parameters<typeof setLastSignedOutResult>[0]);
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
  expect(showModal).not.toHaveBeenCalled();
  for (const release of releases.slice(1)) release();
  await loading;
  expect(showModal).toHaveBeenCalledWith("LastSignedOutResult");
});
