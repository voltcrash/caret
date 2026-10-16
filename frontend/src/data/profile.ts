import type { Client } from "@oxytype/schemas/shared";
import type { UserProfile } from "@oxytype/schemas/users";
import { queryOptions } from "@tanstack/solid-query";
import { getProfile } from "../functions/profile";

/** The service's 404 message, preserved across SSR calls and RPC. */
export function isUserNotFound(error: unknown): boolean {
  return error instanceof Error && error.message.includes("User not found");
}

export const profileOptions = (
  uidOrName: string,
  client: Client,
): ReturnType<typeof queryOptions<UserProfile>> =>
  queryOptions<UserProfile>({
    queryKey: ["public", "profile", uidOrName, client],
    queryFn: async ({ signal }) =>
      await getProfile({ data: { uidOrName, client }, signal }),
    staleTime: 3_600_000,
    retry: (failures, error) => !isUserNotFound(error) && failures < 3,
    meta: { ssrSafe: true },
  });
