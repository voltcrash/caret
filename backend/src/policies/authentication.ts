import { getSessionCookie } from "better-auth/cookies";
import type { RequestAuthenticationOptions } from "@caret/contracts/util/api";
import MonkeyError from "../utils/error";
import { verifySession, type SessionLookup } from "../utils/auth";
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
  /** Bypass the session cookie cache (admin operations). */
  fresh?: boolean;
  setCookie?: (cookie: string) => void;
}): Promise<Actor> {
  const options = { ...DEFAULT_OPTIONS, ...input.options };
  const lookup: SessionLookup = {
    fresh: input.fresh === true || options.requireFreshToken === true,
    setCookie: input.setCookie,
  };
  const authHeader = input.headers.get("authorization");

  if (authHeader !== null && authHeader !== "") {
    return await authenticateWithAuthHeader(authHeader, options, lookup);
  }
  const cookie = input.headers.get("cookie") ?? "";
  if (
    typeof getSessionCookie(new Headers({ cookie }), {
      cookiePrefix: "caret",
    }) === "string"
  ) {
    return await authenticateWithSession(
      new Headers({ cookie }),
      options,
      "Session",
      lookup,
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
  lookup: SessionLookup,
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
        lookup,
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
  lookup: SessionLookup,
): Promise<Actor> {
  const session = await verifySession(headers, lookup);
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
