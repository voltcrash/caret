import "@tanstack/solid-start/server-only";
import type { Client } from "@oxytype/schemas/shared";
import type { OperationData } from "@oxytype/backend/policies/operation-runner";
import { runOperation } from "./operation.server";
import type { ServiceContext } from "./context.server";

/** Public profile DTO; visibility, bans and configuration gates stay in the service/policy. */
export async function readProfile(
  context: ServiceContext,
  input: { uidOrName: string; client: Client },
): Promise<OperationData<"users.getProfile">> {
  return await runOperation(context, "users.getProfile", {
    query: { isUid: false, client: input.client },
    params: { uidOrName: input.uidOrName },
  });
}
