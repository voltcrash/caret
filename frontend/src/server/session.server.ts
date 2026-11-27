import "@tanstack/solid-start/server-only";
import { readUiSession } from "@caret/backend/auth/ui-session";
import { getCachedConfiguration } from "@caret/backend/configuration";
import {
  assertGoodAuthentication,
  badAuthenticationPoints,
  enforceLimit,
} from "@caret/backend/policies/rate-limit";
import { ROOT_LIMIT, SESSION_LIMIT } from "@caret/backend/rate-counter";
import { GUEST } from "@caret/backend/services/context";
import {
  setResponseHeader,
  setResponseStatus,
} from "@tanstack/solid-start/server";
import ApiError from "@caret/backend/errors";
import type { SessionState } from "@caret/schemas/auth-session";
import type { ServiceContext } from "./context.server";

export async function readSessionState(
  request: ServiceContext,
): Promise<SessionState> {
  try {
    const client = { ip: request.clientIp };
    const gate = { actor: GUEST, client };
    // SSR reads share the document response; only a direct call owns headers.
    const header = request.rpc ? setResponseHeader : (): undefined => undefined;
    // Independent gates run together; the session read waits for all of them.
    const [configuration, badAuthentication] = await Promise.all([
      getCachedConfiguration(),
      badAuthenticationPoints(client.ip),
      enforceLimit("root", ROOT_LIMIT, gate, header, false),
      enforceLimit("auth.session", SESSION_LIMIT, gate, header, false),
    ]);
    assertGoodAuthentication(configuration, badAuthentication);
    return {
      user: await readUiSession(request.request.headers),
      signUpEnabled:
        configuration.users.signUp &&
        !configuration.maintenance &&
        request.runtime.env.MAINTENANCE !== "true",
    };
  } catch (error) {
    if (request.rpc) {
      setResponseStatus(error instanceof ApiError ? error.status : 500);
    }
    throw new Error(
      error instanceof ApiError
        ? error.message
        : `Unable to read session ${request.requestId}`,
    );
  }
}
