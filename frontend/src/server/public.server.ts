import "@tanstack/solid-start/server-only";
import { getTypingStats } from "@oxytype/backend/services/public-operations";
import { runOperation } from "./operation.server";
import type { ServiceContext } from "./context.server";
export async function readTypingStats(
  context: ServiceContext,
): Promise<Awaited<ReturnType<typeof getTypingStats>>["data"]> {
  return (
    await runOperation(
      context,
      "public.getTypingStats",
      { query: { client: "web" }, body: undefined, params: undefined },
      getTypingStats,
    )
  ).data;
}
