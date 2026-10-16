import { createServerFn } from "@tanstack/solid-start";
import { callOperation } from "../../server/operation.server";
import { operationInput } from "./input";

export const quotesGet = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "quotes.get", data),
  );

export const quotesGetRating = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "quotes.getRating", data),
  );

export const quotesIsSubmissionEnabled = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "quotes.isSubmissionEnabled", data),
  );

export const quotesAdd = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "quotes.add", data),
  );

export const quotesAddRating = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "quotes.addRating", data),
  );

export const quotesApproveSubmission = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "quotes.approveSubmission", data),
  );

export const quotesRejectSubmission = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "quotes.rejectSubmission", data),
  );

export const quotesReport = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "quotes.report", data),
  );
