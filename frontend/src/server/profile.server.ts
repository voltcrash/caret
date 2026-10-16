import "@tanstack/solid-start/server-only";
import type { Client } from "@oxytype/schemas/shared";
import { getProfile } from "@oxytype/backend/services/profile";
import { runOperation } from "./operation.server";
import type { ServiceContext } from "./context.server";

/** Public profile DTO; visibility, bans and configuration gates stay in the service/policy. */
export async function readProfile(
  context: ServiceContext,
  input: { uidOrName: string; client: Client },
): Promise<Awaited<ReturnType<typeof getProfile>>["data"]> {
  return (
    await runOperation(
      context,
      "users.getProfile",
      {
        query: { isUid: false, client: input.client },
        body: undefined,
        params: { uidOrName: input.uidOrName },
      },
      getProfile,
    )
  ).data;
}
