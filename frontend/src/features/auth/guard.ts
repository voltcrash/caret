import { redirect } from "@tanstack/solid-router";
import { getSessionState } from "../../functions/session";
import type { UiSession } from "@oxytype/schemas/auth-session";
import { authRedirect } from "./session";
/** Stage 4 private layouts call this; operations independently authorize every call. */
export async function requireSession(returnTo: string): Promise<UiSession> {
  const { user } = await getSessionState();
  if (user === null) {
    // oxlint-disable-next-line typescript/only-throw-error -- Router consumes this redirect.
    throw redirect({
      to: "/login",
      search: { redirect: authRedirect(returnTo) },
    });
  }
  return user;
}
