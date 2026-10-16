import { createServerFn } from "@tanstack/solid-start";
import { z } from "zod";
import { SelectionSchema } from "../features/leaderboards/selection";
import {
  readLeaderboard,
  readLeaderboardRank,
} from "../server/leaderboards.server";

export const getLeaderboard = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        selection: SelectionSchema,
        page: z.number().int().nonnegative().max(100_000),
      })
      .parse(input),
  )
  .handler(
    async ({ context, data }) =>
      await readLeaderboard(context.services, data.selection, data.page),
  );

export const getLeaderboardRank = createServerFn({ method: "GET" })
  .validator((input: unknown) => SelectionSchema.parse(input))
  .handler(
    async ({ context, data }) =>
      await readLeaderboardRank(context.services, data),
  );
