import { getSessionCookie } from "better-auth/cookies";
import type { RequestAuthenticationOptions } from "@oxytype/contracts/util/api";
import MonkeyError from "../utils/error";
import { verifySession } from "../utils/auth";
import { isDevEnvironment } from "../utils/misc";
import { GUEST, type Actor } from "../services/context";

const DEFAULT_OPTIONS: RequestAuthenticationOptions = {
  isPublic: false,
  requireFreshToken: false,
  isPublicOnDev: false,
};

/** A session younger than this may perform fresh-session operations. */
export const FRESH_SESSION_MS = 60 * 1000;

export function isPublicOperation(
  options: RequestAuthenticationOptions = {},
): boolean {
  return (
    options.isPublic === true ||
    (options.isPublicOnDev === true && isDevEnvironment())
  );
}

/**
 * Resolve the actor for an operation from transport-neutral headers.
 * By default a session (cookie or Bearer) is required.
 */
export async function authenticate(input: {
  headers: Headers;
  options?: RequestAuthenticationOptions;
  endpoint: string;
}): Promise<Actor> {
  const options = { ...DEFAULT_OPTIONS, ...input.options };
  const authHeader = input.headers.get("authorization");

  if (authHeader !== null && authHeader !== "") {
    return await authenticateWithAuthHeader(authHeader, options);
  }
  const cookie = input.headers.get("cookie") ?? "";
  if (
    typeof getSessionCookie(new Headers({ cookie }), {
      cookiePrefix: "oxytype",
    }) === "string"
  ) {
    return await authenticateWithSession(
      new Headers({ cookie }),
      options,
      "Session",
    );
  }
  if (isPublicOperation(options)) return { ...GUEST };
  throw new MonkeyError(
    401,
    "Unauthorized",
    `endpoint: ${input.endpoint} no authorization header found`,
  );
}

async function authenticateWithAuthHeader(
  authHeader: string,
  options: RequestAuthenticationOptions,
): Promise<Actor> {
  const [authScheme, token] = authHeader.split(" ");

  if (token === undefined) {
    throw new MonkeyError(
      401,
      "Missing authentication token",
      "authenticateWithAuthHeader",
    );
  }

  switch (authScheme?.trim()) {
    case "Bearer":
      return await authenticateWithSession(
        new Headers({ authorization: `Bearer ${token}` }),
        options,
        "Bearer",
      );
    case "Uid":
      return authenticateWithUid(token);
  }

  throw new MonkeyError(
    401,
    "Unknown authentication scheme",
    `The authentication scheme "${authScheme}" is not implemented`,
  );
}

async function authenticateWithSession(
  headers: Headers,
  options: RequestAuthenticationOptions,
  type: "Bearer" | "Session",
): Promise<Actor> {
  const session = await verifySession(headers);
  if (
    options.requireFreshToken === true &&
    Date.now() - session.createdAt.getTime() > FRESH_SESSION_MS
  ) {
    throw new MonkeyError(
      401,
      "Unauthorized",
      "This endpoint requires a fresh token",
    );
  }
  return { type, uid: session.uid, email: session.email };
}

function authenticateWithUid(token: string): Actor {
  if (!isDevEnvironment()) {
    throw new MonkeyError(401, "Bearer type uid is not supported");
  }
  const [uid, email] = token.split("|");

  if (uid === undefined || uid === "") {
    throw new MonkeyError(401, "Missing uid");
  }

  return { type: "Bearer", uid, email: email ?? "" };
}
