import { ConfigurationSchema } from "@oxytype/schemas/configuration";
import { QueryClient } from "@tanstack/solid-query";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
const { environment, get } = vi.hoisted(() => ({
  environment: { devOffline: false },
  get: vi.fn(),
}));
vi.mock("virtual:env-config", () => ({ envConfig: environment }));
vi.mock("../../src/ts/ape", () => ({ default: { configuration: { get } } }));
import { getServerConfigurationQueryOptions } from "../../src/ts/queries/server-configuration";
const client = new QueryClient();
beforeEach(() => {
  get.mockReset();
  environment.devOffline = false;
});
afterEach(() => client.clear());

it("loads schema-valid frontend-only defaults without contacting the API", async () => {
  environment.devOffline = true;
  const configuration = await client.query(
    getServerConfigurationQueryOptions(),
  );
  expect(ConfigurationSchema.safeParse(configuration).success).toBe(true);
  expect(configuration.results.savingEnabled).toBe(false);
  expect(configuration.users.signUp).toBe(false);
  expect(configuration.dailyLeaderboards.enabled).toBe(false);
  expect(configuration.leaderboards.weeklyXp.enabled).toBe(false);
  expect(get).not.toHaveBeenCalled();
});

it("uses the backend configuration normally", async () => {
  get.mockResolvedValue({ status: 200, body: { data: { maintenance: true } } });
  expect(await client.query(getServerConfigurationQueryOptions())).toEqual({
    maintenance: true,
  });
  expect(get).toHaveBeenCalledOnce();
});
