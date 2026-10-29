import "@tanstack/solid-start/server-only";
import type { Client } from "@caret/schemas/shared";
import type { OperationData } from "@caret/backend/policies/operation-runner";
import type { OperationResult } from "../data/operation-result";
import { callOperation } from "./operation.server";
import type { ServiceContext } from "./context.server";

/** Public profile DTO; visibility, bans and configuration gates stay in the service/policy. */
export async function readProfile(
  context: ServiceContext,
  input: { uidOrName: string; client: Client },
): Promise<OperationResult<OperationData<"users.getProfile">>> {
  return await callOperation(context, "users.getProfile", {
    query: { isUid: false, client: input.client },
    params: { uidOrName: input.uidOrName },
  });
}
