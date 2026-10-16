import { createServerFn } from "@tanstack/solid-start";
import { callOperation } from "../../server/operation.server";
import { operationInput } from "./input";

export const presetsGet = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "presets.get", data),
  );

export const presetsAdd = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "presets.add", data),
  );

export const presetsDelete = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "presets.delete", data),
  );

export const presetsSave = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "presets.save", data),
  );
