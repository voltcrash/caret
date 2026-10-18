import { createServerFn } from "@tanstack/solid-start";
import { callOperation } from "../../server/operation.server";
import { operationInput } from "./input";

export const psasGet = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "psas.get", data),
  );
