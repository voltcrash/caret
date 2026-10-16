import { createServerFn } from "@tanstack/solid-start";
import { callOperation } from "../../server/operation.server";
import { operationInput } from "./input";

export const leaderboardsGet = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "leaderboards.get", data),
  );

export const leaderboardsGetRank = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "leaderboards.getRank", data),
  );

export const leaderboardsGetDaily = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "leaderboards.getDaily", data),
  );

export const leaderboardsGetDailyRank = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "leaderboards.getDailyRank", data),
  );

export const leaderboardsGetWeeklyXp = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "leaderboards.getWeeklyXp", data),
  );

export const leaderboardsGetWeeklyXpRank = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(
        context.services,
        "leaderboards.getWeeklyXpRank",
        data,
      ),
  );
