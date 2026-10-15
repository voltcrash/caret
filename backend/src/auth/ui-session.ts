import { UiSessionSchema, type UiSession } from "@oxytype/schemas/auth-session";
import { getAuth } from "../init/auth";
import { exists } from "../dal/user";

/** Authentication boundary: never return token, expiry records or provider credentials. */
export async function readUiSession(
  headers: Headers,
): Promise<UiSession | null> {
  const auth = getAuth();
  const session = await auth.api.getSession({
    headers,
    query: { disableCookieCache: true },
  });
  if (
    session === null ||
    ("disabled" in session.user && session.user.disabled === true)
  ) {
    return null;
  }
  const accounts = await (
    await auth.$context
  ).internalAdapter.findAccounts(session.user.id);
  return UiSessionSchema.parse({
    uid: session.user.id,
    email: session.user.email,
    displayName: session.user.name,
    registered: await exists(session.user.id),
    providerData: accounts
      .filter(
        ({ providerId }) => providerId === "google" || providerId === "github",
      )
      .map(({ providerId }) => ({ providerId, email: session.user.email })),
  });
}
