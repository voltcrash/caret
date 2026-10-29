import type { Client } from "@caret/schemas/shared";
import type { UserProfile } from "@caret/schemas/users";
import { queryOptions } from "@tanstack/solid-query";
import { isServer } from "solid-js/web";
import { OperationError } from "./operation-result";
import { getProfile } from "../functions/profile";

/** Only a missing user is a missing profile; outages remain retryable. */
export function isUserNotFound(error: unknown): boolean {
  return error instanceof OperationError && error.status === 404;
}

export const profileOptions = (
  uidOrName: string,
  client: Client,
): ReturnType<typeof queryOptions<UserProfile>> =>
  queryOptions<UserProfile>({
    queryKey: ["public", "profile", uidOrName, client],
    queryFn: async ({ signal }) => {
      const result = await getProfile({ data: { uidOrName, client }, signal });
      if (!result.ok) throw new OperationError(result);
      return result.data;
    },
    staleTime: 3_600_000,
    // One browser retry for transient errors; never retry policy rejections.
    retry: (failures, error) =>
      !isServer &&
      !(error instanceof OperationError && error.status < 500) &&
      failures < 1,
    meta: { ssrSafe: true },
  });
