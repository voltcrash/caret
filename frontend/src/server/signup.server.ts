import "@tanstack/solid-start/server-only";
import type { CreateUserRequest } from "@oxytype/contracts/users";
import { runOperation } from "./operation.server";
import type { ServiceContext } from "./context.server";
export async function completeSignUp(
  context: ServiceContext,
  body: CreateUserRequest,
): Promise<void> {
  await runOperation(context, "users.create", { body });
}
