import { createServerFn } from "@tanstack/solid-start";
import { CreateUserRequestSchema } from "@oxytype/contracts/users";
import { completeSignUp as complete } from "../server/signup.server";
export const completeSignUp = createServerFn({ method: "POST" })
  .validator((input: unknown) => CreateUserRequestSchema.parse(input))
  .handler(async ({ context, data }) => await complete(context.services, data));
