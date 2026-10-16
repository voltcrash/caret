import { createServerFn } from "@tanstack/solid-start";
import { callOperation } from "../../server/operation.server";
import { operationInput } from "./input";

export const resultsAdd = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "results.add", data),
  );

export const resultsGet = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "results.get", data),
  );

export const resultsGetById = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "results.getById", data),
  );

export const resultsUpdateTags = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "results.updateTags", data),
  );
