import { getSessionCookie } from "better-auth/cookies";
import type { RequestAuthenticationOptions } from "@oxytype/contracts/util/api";
import type { Configuration } from "@oxytype/schemas/configuration";
import { verifyApeKey } from "../utils/ape-key-hash";
import { getApeKey, updateLastUsedOn } from "../dal/ape-keys";
import MonkeyError from "../utils/error";
import { verifySession } from "../utils/auth";
import { base64UrlDecode, isDevEnvironment } from "../utils/misc";
import statuses from "../constants/monkey-status-codes";
import { GUEST, type Actor } from "../services/context";

const DEFAULT_OPTIONS: RequestAuthenticationOptions = {
  isPublic: false,
  acceptApeKeys: false,
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
  configuration: Configuration;
  options?: RequestAuthenticationOptions;
  endpoint: string;
}): Promise<Actor> {
  const options = { ...DEFAULT_OPTIONS, ...input.options };
  const authHeader = input.headers.get("authorization");

  if (authHeader !== null && authHeader !== "") {
    return await authenticateWithAuthHeader(
      authHeader,
      input.configuration,
      options,
    );
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
  configuration: Configuration,
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
    case "ApeKey":
      return await authenticateWithApeKey(token, configuration, options);
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

async function authenticateWithApeKey(
  key: string,
  configuration: Configuration,
  options: RequestAuthenticationOptions,
): Promise<Actor> {
  if (!isPublicOperation(options)) {
    if (!configuration.apeKeys.acceptKeys) {
      throw new MonkeyError(503, "ApeKeys are not being accepted at this time");
    }

    if (options.acceptApeKeys !== true) {
      throw new MonkeyError(401, "This endpoint does not accept ApeKeys");
    }
  }

  try {
    const decodedKey = base64UrlDecode(key);
    const [keyId, apeKey] = decodedKey.split(".");

    if (
      keyId === undefined ||
      keyId === "" ||
      apeKey === undefined ||
      apeKey === ""
    ) {
      throw new MonkeyError(400, "Malformed ApeKey");
    }

    const targetApeKey = await getApeKey(keyId);
    if (!targetApeKey) {
      throw new MonkeyError(404, "ApeKey not found");
    }

    if (!targetApeKey.enabled) {
      const { code, message } = statuses.APE_KEY_INACTIVE;
      throw new MonkeyError(code, message);
    }

    if (!verifyApeKey(apeKey, targetApeKey.hash)) {
      const { code, message } = statuses.APE_KEY_INVALID;
      throw new MonkeyError(code, message);
    }

    await updateLastUsedOn(targetApeKey.uid, keyId);

    return { type: "ApeKey", uid: targetApeKey.uid, email: "" };
  } catch (error) {
    if (!(error instanceof MonkeyError)) {
      const { code, message } = statuses.APE_KEY_MALFORMED;
      throw new MonkeyError(code, message);
    }

    throw error;
  }
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
