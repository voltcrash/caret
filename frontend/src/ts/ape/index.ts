import { envConfig } from "virtual:env-config";
import { lazyClient } from "./lazy-client";

const BASE_URL = envConfig.backendUrl;

// The ts-rest runtime and each contract load with the first request.
async function loadBuildClient(): Promise<
  typeof import("./adapters/ts-rest-adapter").buildClient
> {
  return (await import("./adapters/ts-rest-adapter")).buildClient;
}

const Ape = {
  admin: lazyClient(async () => {
    const { adminContract } = await import("@oxytype/contracts/admin");
    return (await loadBuildClient())(adminContract, BASE_URL);
  }),
  apeKeys: lazyClient(async () => {
    const { apeKeysContract } = await import("@oxytype/contracts/ape-keys");
    return (await loadBuildClient())(apeKeysContract, BASE_URL);
  }),
  configs: lazyClient(async () => {
    const { configsContract } = await import("@oxytype/contracts/configs");
    return (await loadBuildClient())(configsContract, BASE_URL);
  }),
  presets: lazyClient(async () => {
    const { presetsContract } = await import("@oxytype/contracts/presets");
    return (await loadBuildClient())(presetsContract, BASE_URL);
  }),
  psas: lazyClient(async () => {
    const { psasContract } = await import("@oxytype/contracts/psas");
    return (await loadBuildClient())(psasContract, BASE_URL);
  }),
  public: lazyClient(async () => {
    const { publicContract } = await import("@oxytype/contracts/public");
    return (await loadBuildClient())(publicContract, BASE_URL);
  }),
  leaderboards: lazyClient(async () => {
    const { leaderboardsContract } =
      await import("@oxytype/contracts/leaderboards");
    return (await loadBuildClient())(leaderboardsContract, BASE_URL);
  }),
  results: lazyClient(async () => {
    const { resultsContract } = await import("@oxytype/contracts/results");
    return (await loadBuildClient())(resultsContract, BASE_URL);
  }),
  configuration: lazyClient(async () => {
    const { configurationContract } =
      await import("@oxytype/contracts/configuration");
    return (await loadBuildClient())(configurationContract, BASE_URL);
  }),
  users: lazyClient(async () => {
    const { usersContract } = await import("@oxytype/contracts/users");
    return (await loadBuildClient())(usersContract, BASE_URL);
  }),
  quotes: lazyClient(async () => {
    const { quotesContract } = await import("@oxytype/contracts/quotes");
    return (await loadBuildClient())(quotesContract, BASE_URL);
  }),
  dev: lazyClient(async () => {
    const { devContract } = await import("@oxytype/contracts/dev");
    return (await loadBuildClient())(devContract, BASE_URL, 240_000);
  }),
};

export default Ape;
