import { queryOptions } from "@tanstack/solid-query";
import type { TypingStats } from "@oxytype/schemas/public";
import { getTypingStats } from "../functions/public";

export const typingStatsOptions = (): ReturnType<
  typeof queryOptions<TypingStats>
> =>
  queryOptions<TypingStats>({
    queryKey: ["public", "typingStats", "web"],
    queryFn: async () => await getTypingStats(),
    staleTime: 3_600_000,
    meta: { ssrSafe: true },
  });
