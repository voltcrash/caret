import "@tanstack/solid-start/server-only";
import { readUiSession } from "@oxytype/backend/auth/ui-session";
import { getCachedConfiguration } from "@oxytype/backend/configuration";
import {
  checkBadAuthentication,
  enforceLimit,
} from "@oxytype/backend/policies/rate-limit";
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
    const configuration = await getCachedConfiguration();
    const context = {
      actor: GUEST,
      runtime: request.runtime,
      requestId: request.requestId,
      background: request.background,
      configuration,
      client: { ip: request.clientIp },
    };
    await checkBadAuthentication(context);
    await enforceLimit(
      "root",
      { window: "hour", max: 1000 },
      context,
      setResponseHeader,
      false,
    );
    await enforceLimit(
      "auth.session",
      { window: "minute", max: 60 },
      context,
      setResponseHeader,
      false,
    );
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
