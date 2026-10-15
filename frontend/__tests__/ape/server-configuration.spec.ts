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
  beforeEach(() => {
    vi.resetModules();
    query.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves readiness after fetching configuration", async () => {
    query.mockResolvedValue({});
    const { sync, configurationPromise } =
      await import("../../src/ts/ape/server-configuration");

    await sync();

    await expect(configurationPromise).resolves.toBe(true);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("handles offline startup before a page awaits configuration", async () => {
    const error = new Error("Could not fetch configuration: Failed to fetch");
    query.mockRejectedValue(error);
    const { sync, configurationPromise } =
      await import("../../src/ts/ape/server-configuration");

    await sync();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    await expect(configurationPromise).rejects.toBe(error);
    expect(console.error).toHaveBeenCalledWith(
      "Failed to synchronize server configuration",
      error,
    );
  });
});
