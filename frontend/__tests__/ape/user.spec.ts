import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const state = vi.hoisted(() => ({
  userId: "first" as string | null,
  get: vi.fn(),
  reset: vi.fn(),
}));
vi.mock("../../src/ts/ape", () => ({ default: { users: { get: state.get } } }));
vi.mock("../../src/ts/states/core", () => ({ getUserId: () => state.userId }));
vi.mock("../../src/ts/hooks/effects", () => ({
  createModuleEffectOn: (
    _hot: unknown,
    _get: unknown,
    reset: (userId: string | null) => void,
  ) => {
    state.reset = vi.fn(() => reset(state.userId));
  },
}));

beforeEach(async () => {
  vi.resetModules();
  await import("../__harness__/mock-application");
  state.get.mockReset();
  state.userId = "first";
});

it("shares the onboarding request with snapshot and collection consumers", async () => {
  state.get.mockResolvedValue({
    status: 200,
    body: { data: { name: "first" } },
  });
  const { fetchUserFromApi } = await import("../../src/ts/ape/user");
  const results = await Promise.all([fetchUserFromApi(), fetchUserFromApi()]);
  expect(results).toEqual([{ name: "first" }, { name: "first" }]);
  await fetchUserFromApi();
  state.reset();
  await fetchUserFromApi();
  expect(state.get).toHaveBeenCalledOnce();
});

it("retries failed requests, including unfinished signup", async () => {
  state.get
    .mockResolvedValueOnce({ status: 404, body: { message: "Not found" } })
    .mockResolvedValueOnce({ status: 200, body: { data: { name: "first" } } });
  const { fetchUserFromApi } = await import("../../src/ts/ape/user");
  await expect(fetchUserFromApi()).rejects.toMatchObject({ responseCode: 404 });
  await expect(fetchUserFromApi()).resolves.toEqual({ name: "first" });
  expect(state.get).toHaveBeenCalledTimes(2);
});

it("never reuses another user's data or a request completed after logout", async () => {
  let finish!: (value: unknown) => void;
  state.get.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { fetchUserFromApi } = await import("../../src/ts/ape/user");
  const first = fetchUserFromApi();
  state.userId = null;
  state.reset();
  await expect(fetchUserFromApi()).resolves.toBeUndefined();
  state.userId = "second";
  state.get.mockResolvedValue({
    status: 200,
    body: { data: { name: "second" } },
  });
  await expect(fetchUserFromApi()).resolves.toEqual({ name: "second" });
  finish({ status: 200, body: { data: { name: "first" } } });
  await first;
  await expect(fetchUserFromApi()).resolves.toEqual({ name: "second" });
  expect(state.get).toHaveBeenCalledTimes(2);
});

afterEach(async () => {
  (await import("../__harness__/mock-application")).releaseTestApplication();
});
