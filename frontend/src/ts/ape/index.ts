import { envConfig } from "virtual:env-config";
import { buildClient } from "./adapters/ts-rest-adapter";
import { lazyClient } from "./lazy-client";

const BASE_URL = envConfig.backendUrl;

const Ape = {
  admin: lazyClient(async () => {
    const { adminContract } = await import("@oxytype/contracts/admin");
    return buildClient(adminContract, BASE_URL);
  }),
  apeKeys: lazyClient(async () => {
    const { apeKeysContract } = await import("@oxytype/contracts/ape-keys");
    return buildClient(apeKeysContract, BASE_URL);
  }),
  configs: lazyClient(async () => {
    const { configsContract } = await import("@oxytype/contracts/configs");
    return buildClient(configsContract, BASE_URL);
  }),
  presets: lazyClient(async () => {
    const { presetsContract } = await import("@oxytype/contracts/presets");
    return buildClient(presetsContract, BASE_URL);
  }),
  psas: lazyClient(async () => {
    const { psasContract } = await import("@oxytype/contracts/psas");
    return buildClient(psasContract, BASE_URL);
  }),
  public: lazyClient(async () => {
    const { publicContract } = await import("@oxytype/contracts/public");
    return buildClient(publicContract, BASE_URL);
  }),
  leaderboards: lazyClient(async () => {
    const { leaderboardsContract } =
      await import("@oxytype/contracts/leaderboards");
    return buildClient(leaderboardsContract, BASE_URL);
  }),
  results: lazyClient(async () => {
    const { resultsContract } = await import("@oxytype/contracts/results");
    return buildClient(resultsContract, BASE_URL);
  }),
  configuration: lazyClient(async () => {
    const { configurationContract } =
      await import("@oxytype/contracts/configuration");
    return buildClient(configurationContract, BASE_URL);
  }),
  users: lazyClient(async () => {
    const { usersContract } = await import("@oxytype/contracts/users");
    return buildClient(usersContract, BASE_URL);
  }),
  quotes: lazyClient(async () => {
    const { quotesContract } = await import("@oxytype/contracts/quotes");
    return buildClient(quotesContract, BASE_URL);
  }),
  dev: lazyClient(async () => {
    const { devContract } = await import("@oxytype/contracts/dev");
    return buildClient(devContract, BASE_URL, 240_000);
  }),
};

export default Ape;
