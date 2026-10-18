import "@tanstack/solid-start/server-only";
import type { OperationData } from "@oxytype/backend/policies/operation-runner";
import { runOperation } from "./operation.server";
import type { ServiceContext } from "./context.server";

export async function readTypingStats(
  context: ServiceContext,
): Promise<OperationData<"public.getTypingStats">> {
  return await runOperation(context, "public.getTypingStats", {
    query: { client: "web" },
  });
}

/** The about page's time 60 English distribution. */
export async function readSpeedHistogram(
  context: ServiceContext,
): Promise<OperationData<"public.getSpeedHistogram">> {
  return await runOperation(context, "public.getSpeedHistogram", {
    query: { language: "english", mode: "time", mode2: "60", client: "web" },
  });
}
