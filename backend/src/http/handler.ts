import { getSessionCookie } from "better-auth/cookies";
import { parseJsonQueryObject } from "@ts-rest/core";
import {
  COMPATIBILITY_CHECK,
  COMPATIBILITY_CHECK_HEADER,
} from "@oxytype/contracts";
import qs from "qs";
import {
  admit,
  assertAvailable,
  describeFailure,
  execute,
  type Invocation,
  type PolicyScope,
} from "../policies/operation-runner";
import type { OperationId } from "../policies/operations";
import MonkeyError from "../utils/error";
import { createETagGenerator } from "../utils/etag";
import { getFrontendUrl } from "../utils/misc";
import { isCustomCode } from "../constants/monkey-status-codes";
import { getVersion } from "../version";

export type HttpInvocation = Omit<Invocation, "setHeader">;
const generateETag = createETagGenerator({ weak: true });
const bootedAt = Date.now();

/** The Worker has already bounded/decompressed the request. Auth owns its own body. */
async function parseBody(request: Request): Promise<unknown> {
  const type = request.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (
    type !== "application/json" &&
    type !== "application/x-www-form-urlencoded"
  ) {
    return {};
  }
  const text = await request.text();
  if (text.length === 0) return {};
  if (type === "application/json") {
    if (!/^[\s\uFEFF]*[[{]/.test(text)) {
      throw new SyntaxError("Invalid JSON request body");
    }
    return JSON.parse(text.replace(/^\uFEFF/, "")) as unknown;
  }
  if (text.split("&").length > 1000) {
    throw new MonkeyError(413, "Too many request parameters");
  }
  return qs.parse(text, { depth: 32, strictDepth: true, parameterLimit: 1000 });
}

function json(body: unknown, status = 200, statusText?: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** Conditional HTTP responses retain the versioned weak ETag contract. */
async function conditional(
  request: Request,
  response: Response,
): Promise<Response> {
  if (
    response.status === 204 ||
    response.status === 304 ||
    response.body === null
  ) {
    return response;
  }
  const etag =
    response.headers.get("etag") ??
    generateETag(Buffer.from(await response.clone().arrayBuffer()), undefined);
  response.headers.set("ETag", etag);
  const match = request.headers.get("if-none-match");
  const modified = request.headers.get("if-modified-since");
  const lastModified = response.headers.get("last-modified");
  const dateMatches =
    modified !== null &&
    lastModified !== null &&
    Date.parse(lastModified) <= Date.parse(modified);
  const tagMatches =
    match !== null &&
    (match.trim() === "*" ||
      match
        .split(",")
        .some(
          (tag) => tag.trim().replace(/^W\//, "") === etag.replace(/^W\//, ""),
        ));
  const fresh =
    (match !== null ? tagMatches : dateMatches) &&
    (modified === null || dateMatches);
  if (
    ["GET", "HEAD"].includes(request.method) &&
    response.status >= 200 &&
    response.status < 300 &&
    !/\bno-cache\b/i.test(request.headers.get("cache-control") ?? "") &&
    fresh
  ) {
    const headers = new Headers(response.headers);
    for (const name of [
      "content-type",
      "content-length",
      "transfer-encoding",
      "content-range",
    ]) {
      headers.delete(name);
    }
    return new Response(null, { status: 304, headers });
  }
  return response;
}

/** HTTP protocol policy around shared services; no router/framework request objects. */
async function handle(
  input: HttpInvocation,
  request: Request,
  endpoint: string,
  handler: (
    invocation: Invocation,
    scope: PolicyScope,
    body: unknown,
  ) => Promise<Response>,
): Promise<Response> {
  const headers = new Headers({
    [COMPATIBILITY_CHECK_HEADER]: String(COMPATIBILITY_CHECK),
  });
  const origin = new URL(getFrontendUrl()).origin;
  headers.set("Vary", "Origin");
  if (request.headers.get("origin") === origin) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Expose-Headers", COMPATIBILITY_CHECK_HEADER);
  if (request.method === "OPTIONS") {
    headers.set(
      "Access-Control-Allow-Methods",
      "GET,HEAD,PUT,PATCH,POST,DELETE",
    );
    const allowed = request.headers.get("access-control-request-headers");
    if (allowed !== null) headers.set("Access-Control-Allow-Headers", allowed);
    return new Response(null, { status: 204, headers });
  }
  const invocation: Invocation = {
    ...input,
    setHeader: (name, value) => {
      headers.set(name, value);
    },
  };
  let scope: PolicyScope | undefined;
  let response: Response;
  try {
    // Preserve parsing/origin checks before request and operation policy gates.
    const body = await parseBody(request);
    if (
      !["GET", "HEAD"].includes(request.method) &&
      typeof getSessionCookie(request.headers, { cookiePrefix: "oxytype" }) ===
        "string" &&
      !request.headers.has("authorization") &&
      request.headers.get("origin") !== origin
    ) {
      response = json({ message: "Untrusted origin" }, 403);
    } else {
      scope = await admit(invocation);
      assertAvailable(invocation, scope, endpoint.startsWith("configuration."));
      response = await handler(invocation, scope, body);
    }
  } catch (error) {
    const failure = await describeFailure(error, invocation, scope, endpoint);
    response = json(
      {
        message: failure.message,
        data: {
          ...(failure.errorId === undefined
            ? {}
            : { errorId: failure.errorId }),
          uid: failure.uid,
        },
      },
      failure.status,
      isCustomCode(failure.status) ? failure.message : undefined,
    );
  }
  for (const [name, value] of headers) {
    response.headers.set(name, value);
  }
  return await conditional(request, response);
}

export async function runHttpOperation(
  invocation: HttpInvocation,
  request: Request,
  id: OperationId,
  params: Record<string, string>,
): Promise<Response> {
  return await handle(invocation, request, id, async (call, scope, body) => {
    decodeURIComponent(new URL(request.url).pathname);
    const search = new URL(request.url).searchParams;
    const query = Object.fromEntries(
      [...new Set(search.keys())].map((key) => {
        const values = search.getAll(key);
        return [key, values.length === 1 ? values[0] : values];
      }),
    );
    const result = await execute(
      call,
      scope,
      id,
      {
        params,
        query: parseJsonQueryObject(query as Record<string, string>),
        body,
        headers: Object.fromEntries(request.headers),
      },
      { validateResponse: false },
    );
    return result.ok
      ? json({ message: result.message, data: result.data })
      : json(
          {
            message: result.message,
            validationErrors: result.validationErrors,
          },
          result.status,
        );
  });
}

/** Health, documentation and dev configuration are declared Start routes too. */
export async function runHttpAuxiliary(
  invocation: HttpInvocation,
  request: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  return await handle(
    invocation,
    request,
    new URL(request.url).pathname,
    handler,
  );
}

export function healthResponse(): Response {
  return json({
    message: "ok",
    data: { uptime: Date.now() - bootedAt, version: getVersion() },
  });
}
