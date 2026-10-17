import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

vi.mock("../../src/ts/utils/env", () => ({ isDevEnvironment: () => false }));
vi.mock("../../src/ts/utils/json-data", () => ({
  getLatestRelease: vi.fn(async () => "26.10.16"),
}));

describe("release version check", () => {
  const deleted: string[] = [];
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    deleted.length = 0;
    vi.stubGlobal("caches", {
      keys: async () => ["oxytype-start-build", "oxytype-build-assets"],
      delete: async (name: string) => {
        deleted.push(name);
        return true;
      },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records a new release without purging service-worker caches", async () => {
    localStorage.setItem("lastSeenVersion", JSON.stringify("26.10.15"));
    const { fetchLatestVersion } = await import("../../src/ts/utils/version");
    await expect(fetchLatestVersion()).resolves.toEqual({
      text: "26.10.16",
      isNew: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(deleted).toEqual([]);
  });
});
