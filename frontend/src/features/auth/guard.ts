import type { QueryClient } from "@tanstack/solid-query";
import type { UiSession } from "@oxytype/schemas/auth-session";
import { redirect } from "@tanstack/solid-router";
import { authRedirect, sessionOptions } from "./session";

/**
 * Private layout guard: registered accounts only. Reads the canonical session
 * query; every private operation still authorizes itself on the server.
 */
export async function requireSession(
  queryClient: QueryClient,
  returnTo: string,
): Promise<UiSession> {
  if (import.meta.env.OXYTYPE_OFFLINE) {
    // Like the old router: without authentication private pages go home.
    // oxlint-disable-next-line typescript/only-throw-error -- Router consumes this redirect.
    throw redirect({ to: "/" });
  }
  await queryClient.invalidateQueries({ queryKey: sessionOptions().queryKey });
  const { user } = await queryClient.query(sessionOptions());
  if (user === null || !user.registered) {
    // oxlint-disable-next-line typescript/only-throw-error -- Router consumes this redirect.
    throw redirect({
      to: "/login",
      search: { redirect: authRedirect(returnTo) },
    });
  }
  return user;
}
