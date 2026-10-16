import type { AppRouter } from "@ts-rest/core";
import { envConfig } from "virtual:env-config";
import type { OperationResult } from "../data/operation-result";
import type { webOperations as StartOperations } from "../functions/operations";

/**
 * Rollback build only: the same operation IDs over the legacy `/api` HTTP
 * contracts, substituted for Start's server functions at build time. Deleted
 * with the rollback entry in Stage 8.
 */
const contracts: Record<string, () => Promise<AppRouter>> = {
  admin: async () => (await import("@oxytype/contracts/admin")).adminContract,
  apeKeys: async () =>
    (await import("@oxytype/contracts/ape-keys")).apeKeysContract,
  configs: async () =>
    (await import("@oxytype/contracts/configs")).configsContract,
  configuration: async () =>
    (await import("@oxytype/contracts/configuration")).configurationContract,
  dev: async () => (await import("@oxytype/contracts/dev")).devContract,
  leaderboards: async () =>
    (await import("@oxytype/contracts/leaderboards")).leaderboardsContract,
  presets: async () =>
    (await import("@oxytype/contracts/presets")).presetsContract,
  psas: async () => (await import("@oxytype/contracts/psas")).psasContract,
  public: async () =>
    (await import("@oxytype/contracts/public")).publicContract,
  quotes: async () =>
    (await import("@oxytype/contracts/quotes")).quotesContract,
  results: async () =>
    (await import("@oxytype/contracts/results")).resultsContract,
  users: async () => (await import("@oxytype/contracts/users")).usersContract,
};

type Endpoint = (args: object) => Promise<{
  status: number;
  body: { message: string; data?: unknown; validationErrors?: string[] };
}>;
const clients = new Map<string, Promise<Record<string, Endpoint>>>();

async function client(group: string): Promise<Record<string, Endpoint>> {
  let pending = clients.get(group);
  if (pending === undefined) {
    const load = contracts[group];
    if (load === undefined) throw new Error(`Unknown API group: ${group}`);
    pending = (async () => {
      const [contract, { buildClient }] = await Promise.all([
        load(),
        import("./http"),
      ]);
      return buildClient(
        contract,
        envConfig.backendUrl,
        group === "dev" ? 240_000 : 10_000,
      ) as unknown as Record<string, Endpoint>;
    })().catch((error: unknown) => {
      clients.delete(group);
      throw error;
    });
    clients.set(group, pending);
  }
  return await pending;
}

export const webOperations = new Proxy(
  {},
  {
    get: (_target, id) => {
      if (typeof id !== "string") return undefined;
      const [group = "", name = ""] = id.split(".");
      return async (options: {
        data: object;
        signal: AbortSignal;
      }): Promise<OperationResult<unknown>> => {
        const endpoint = (await client(group))[name];
        if (endpoint === undefined) {
          throw new Error(`Unknown API endpoint: ${id}`);
        }
        const response = await endpoint({
          ...options.data,
          fetchOptions: { signal: options.signal },
        });
        return response.status === 200
          ? {
              ok: true,
              status: 200,
              message: response.body.message,
              data: response.body.data,
            }
          : {
              ok: false,
              status: response.status,
              message: response.body.message,
              validationErrors: response.body.validationErrors,
            };
      };
    },
  },
) as typeof StartOperations;
