import { queryOptions } from "@tanstack/solid-query";
import type { SpeedHistogram, TypingStats } from "@oxytype/schemas/public";
import { getSpeedHistogram, getTypingStats } from "../functions/public";

// Global aggregates refresh every 15 minutes; an hour matches the old cache.
const staleTime = 3_600_000;

export const typingStatsOptions = (): ReturnType<
  typeof queryOptions<TypingStats>
> =>
  queryOptions<TypingStats>({
    queryKey: ["public", "typingStats", "web"],
    queryFn: async ({ signal }) => await getTypingStats({ signal }),
    staleTime,
    meta: { ssrSafe: true },
  });

export const speedHistogramOptions = (): ReturnType<
  typeof queryOptions<SpeedHistogram>
> =>
  queryOptions<SpeedHistogram>({
    queryKey: ["public", "speedHistogram", "web", "time", "60", "english"],
    queryFn: async ({ signal }) => await getSpeedHistogram({ signal }),
    staleTime,
    meta: { ssrSafe: true },
  });
