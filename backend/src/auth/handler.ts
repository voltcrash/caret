import MonkeyError from "../utils/error";
import { envValue } from "../runtime/env";
import * as UserDAL from "../dal/user";
import * as AuthUtils from "../utils/auth";
import { getAuth } from "../init/auth";
import { getFrontendUrl } from "../utils/misc";

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
  // Resolve through the API's proxy policy; never trust this caller-supplied header.
  request.headers.set("x-oxytype-auth-ip", ip);
  // Dashboard server requests use the plugin's signed JWT, rather than cookies.
  const dashboardRequest =
    path.startsWith("/auth/dash/") &&
    request.headers.get("authorization")?.startsWith("Bearer ") === true &&
    !request.headers.has("cookie");
  const noBrowserContext =
    !request.headers.has("origin") &&
    !request.headers.has("cookie") &&
    !request.headers.has("sec-fetch-site");
  const nativeDeviceRequest =
    noBrowserContext &&
    ["/auth/device/code", "/auth/device/token"].includes(path);
  let nativeBearerRequest =
    noBrowserContext &&
    request.headers.get("authorization")?.startsWith("Bearer ") === true;
  if (nativeBearerRequest && !dashboardRequest && !nativeDeviceRequest) {
    nativeBearerRequest =
      (await auth.api.getSession({ headers: request.headers })) !== null;
  }
  if (
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    !dashboardRequest &&
    !nativeDeviceRequest &&
    !nativeBearerRequest
  ) {
    const origin = request.headers.get("origin");
    if (origin !== new URL(getFrontendUrl()).origin) {
      return Response.json({ message: "Untrusted origin" }, { status: 403 });
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
