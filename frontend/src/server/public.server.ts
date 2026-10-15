import "@tanstack/solid-start/server-only";
import {
  getSpeedHistogram,
  getTypingStats,
} from "@oxytype/backend/services/public-operations";
import { runOperation } from "./operation.server";
import type { ServiceContext } from "./context.server";
export async function readTypingStats(
  context: ServiceContext,
): Promise<Awaited<ReturnType<typeof getTypingStats>>["data"]> {
  return (
    await runOperation(
      context,
      "public.getTypingStats",
      { query: { client: "web" }, body: undefined, params: undefined },
      getTypingStats,
    )
  ).data;
}

/** The about page's time 60 English distribution. */
export async function readSpeedHistogram(
  context: ServiceContext,
): Promise<Awaited<ReturnType<typeof getSpeedHistogram>>["data"]> {
  return (
    await runOperation(
      context,
      "public.getSpeedHistogram",
      {
        query: {
          language: "english",
          mode: "time",
          mode2: "60",
          client: "web",
        },
        body: undefined,
        params: undefined,
      },
      getSpeedHistogram,
    )
  ).data;
}
