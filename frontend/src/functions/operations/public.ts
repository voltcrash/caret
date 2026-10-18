import { createServerFn } from "@tanstack/solid-start";
import { callOperation } from "../../server/operation.server";
import { operationInput } from "./input";

export const publicGetSpeedHistogram = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "public.getSpeedHistogram", data),
  );

export const publicGetTypingStats = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "public.getTypingStats", data),
  );
