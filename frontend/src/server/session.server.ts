import "@tanstack/solid-start/server-only";
import { readUiSession } from "@oxytype/backend/auth/ui-session";
import { getCachedConfiguration } from "@oxytype/backend/configuration";
import {
  assertGoodAuthentication,
  badAuthenticationPoints,
  enforceLimit,
} from "@oxytype/backend/policies/rate-limit";
import { ROOT_LIMIT, SESSION_LIMIT } from "@oxytype/backend/rate-counter";
import { GUEST } from "@oxytype/backend/services/context";
import {
  setResponseHeader,
  setResponseStatus,
} from "@tanstack/solid-start/server";
import MonkeyError from "@oxytype/backend/errors";
import type { SessionState } from "@oxytype/schemas/auth-session";
import type { ServiceContext } from "./context.server";

export async function readSessionState(
  request: ServiceContext,
): Promise<SessionState> {
  try {
    const client = { ip: request.clientIp };
    const gate = { actor: GUEST, client };
    // Independent gates run together; the session read waits for all of them.
    const [configuration, badAuthentication] = await Promise.all([
      getCachedConfiguration(),
      badAuthenticationPoints(client.ip),
      enforceLimit("root", ROOT_LIMIT, gate, setResponseHeader, false),
      enforceLimit(
        "auth.session",
        SESSION_LIMIT,
        gate,
        setResponseHeader,
        false,
      ),
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
    setResponseStatus(error instanceof MonkeyError ? error.status : 500);
    throw new Error(
      error instanceof MonkeyError
        ? error.message
        : `Unable to read session ${request.requestId}`,
    );
  }
}
