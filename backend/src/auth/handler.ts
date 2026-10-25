import MonkeyError from "../utils/error";
import { envValue } from "../runtime/env";
import * as UserDAL from "../dal/user";
import * as AuthUtils from "../utils/auth";
import { getAuth } from "../init/auth";
import { getFrontendUrl } from "../utils/misc";
import { enforceAuthLimit } from "../policies/rate-limit";

async function dispatchAuthRequest(
  incoming: Request,
  ip: string,
): Promise<Response> {
  const request = new Request(incoming);
  const auth = getAuth();
  const base = new URL(
    envValue("BETTER_AUTH_URL") ?? "http://localhost:5005/auth",
  );
  const path = `/auth${new URL(request.url).pathname.slice(base.pathname.replace(/\/$/, "").length)}`;
  await enforceAuthLimit(path, ip);
  // Resolve through the API's proxy policy; never trust this caller-supplied header.
  request.headers.set("x-oxytype-auth-ip", ip);
  // Dashboard server requests use the plugin's signed JWT, rather than cookies.
  const dashboardRequest =
    path.startsWith("/auth/dash/") &&
    request.headers.get("authorization")?.startsWith("Bearer ") === true &&
    !request.headers.has("cookie");
  // Use Better Auth's bearer/cookie validation, with no cached identity or refresh.
  // Dashboard JWTs are independently authenticated by the dashboard plugin.
  const session = dashboardRequest
    ? null
    : await auth.api.getSession({
        headers: request.headers,
        query: { disableCookieCache: true, disableRefresh: true },
      });
  const noBrowserContext =
    !request.headers.has("origin") &&
    !request.headers.has("cookie") &&
    !request.headers.has("sec-fetch-site");
  const nativeBearerRequest =
    noBrowserContext &&
    !dashboardRequest &&
    request.headers.get("authorization")?.startsWith("Bearer ") === true &&
    session !== null;
  if (
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    !dashboardRequest &&
    !nativeBearerRequest
  ) {
    const origin = request.headers.get("origin");
    if (origin !== new URL(getFrontendUrl()).origin) {
      return Response.json({ message: "Untrusted origin" }, { status: 403 });
    }
  }
  // Reject untrusted writes before revoking disabled sessions.
  if (
    session !== null &&
    "disabled" in session.user &&
    session.user.disabled === true
  ) {
    await (
      await auth.$context
    ).internalAdapter.deleteUserSessions(session.user.id);
    if (path !== "/auth/sign-out") {
      return Response.json({ message: "Account disabled" }, { status: 403 });
    }
  }
  const headers = request.headers;
  if (path === "/auth/cancel-sign-up" && request.method === "POST") {
    const session = await AuthUtils.verifySession(headers);
    const existing = await UserDAL.exists(session.uid);
    if (existing) {
      return Response.json(
        { message: "Account registration is already complete" },
        { status: 409 },
      );
    }
    await AuthUtils.deleteUser(session.uid);
    return Response.json({ status: true });
  }
  return auth.handler(request);
}

/** Both HTTP adapters retain auth status/error semantics. */
export async function handleAuthRequest(
  incoming: Request,
  ip: string,
): Promise<Response> {
  try {
    return await dispatchAuthRequest(incoming, ip);
  } catch (error) {
    if (error instanceof MonkeyError) {
      return Response.json(
        { message: error.message },
        { status: error.status },
      );
    }
    throw error;
  }
}
