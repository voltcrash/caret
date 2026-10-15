import "@tanstack/solid-start/server-only";
import { getStats } from "@oxytype/backend/services/user-data";
import { runOperation } from "./operation.server";
import type { ServiceContext } from "./context.server";
export async function readAccountStats(
  context: ServiceContext,
): Promise<Awaited<ReturnType<typeof getStats>>["data"]> {
  return (
    await runOperation(
      context,
      "users.getStats",
      { query: { client: "web" }, body: undefined, params: undefined },
      getStats,
    )
  ).data;
}
