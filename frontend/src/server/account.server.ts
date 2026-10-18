import "@tanstack/solid-start/server-only";
import type { OperationData } from "@oxytype/backend/policies/operation-runner";
import { runOperation } from "./operation.server";
import type { ServiceContext } from "./context.server";
export async function readAccountStats(
  context: ServiceContext,
): Promise<OperationData<"users.getStats">> {
  return await runOperation(context, "users.getStats", {
    query: { client: "web" },
  });
}
