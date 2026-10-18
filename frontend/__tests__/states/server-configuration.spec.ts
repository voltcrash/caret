import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("../../src/ts/queries", () => ({
  getQueryClient: () => ({ query }),
}));
vi.mock("../../src/ts/queries/server-configuration", () => ({
  getServerConfigurationQueryOptions: () => ({
    queryKey: ["serverConfiguration"],
  }),
}));

describe("server configuration startup", () => {
  beforeEach(async () => {
    vi.resetModules();
    await import("../__harness__/mock-application");
    query.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    (await import("../__harness__/mock-application")).releaseTestApplication();
    vi.restoreAllMocks();
  });

  it("resolves readiness after fetching configuration", async () => {
    query.mockResolvedValue({});
    const { sync } = await import("../../src/ts/states/server-configuration");

    await sync();

    const { configurationReadiness } = await import("../../src/app/readiness");
    expect(configurationReadiness().state()).toEqual({ status: "ready" });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("handles offline startup before a page awaits configuration", async () => {
    const error = new Error("Could not fetch configuration: Failed to fetch");
    query.mockRejectedValue(error);
    const { sync } = await import("../../src/ts/states/server-configuration");

    await expect(sync()).rejects.toBe(error);

    const { configurationReadiness } = await import("../../src/app/readiness");
    expect(configurationReadiness().state()).toEqual({
      status: "error",
      error,
    });
    await expect(configurationReadiness().wait()).rejects.toBe(error);
  });
});
