import "@tanstack/solid-start/server-only";
import { createNewUser } from "@oxytype/backend/services/account";
import type { CreateUserRequest } from "@oxytype/contracts/users";
import { runOperation } from "./operation.server";
import type { ServiceContext } from "./context.server";
export async function completeSignUp(
  context: ServiceContext,
  body: CreateUserRequest,
): Promise<void> {
  await runOperation(
    context,
    "users.create",
    { query: undefined, params: undefined, body },
    createNewUser,
  );
}
