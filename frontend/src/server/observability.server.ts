import "@tanstack/solid-start/server-only";

/** Build of this Worker; the browser reports the same ID to Sentry. */
export const serverBuildId = import.meta.env.OXYTYPE_BUILD_ID;

const clientBuildPattern = /^[\w.-]{1,64}$/;
const serverFnPrefix = "/_serverFn/";

export type RequestKind = "function" | "auth" | "api" | "document";

export type RequestLog = {
  event: "request";
  requestId: string;
  method: string;
  path: string;
  kind: RequestKind;
  /** Server-function ID; stable per function, never its payload. */
  operation?: string;
  status: number;
  durationMs: number;
  build: string;
  release: string | undefined;
  /** Sending client's build; absent or "invalid" when not reported. */
  clientBuild?: string;
  staleClient?: true;
};

export function requestKind(pathname: string): RequestKind {
  if (pathname.startsWith(serverFnPrefix)) return "function";
  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
    return "auth";
  }
  if (pathname === "/api" || pathname.startsWith("/api/")) return "api";
  return "document";
}

/** Old tabs/rollback clients send X-Client-Version; keep only a safe token. */
export function clientBuildOf(headers: Headers): string | undefined {
  const value = headers.get("X-Client-Version");
  if (value === null) return undefined;
  return clientBuildPattern.test(value) ? value : "invalid";
}

/**
 * One structured line per request: release/build skew and operation identity
 * without URLs' query strings, bodies, cookies or tokens.
 */
export function requestLog(options: {
  request: Request;
  requestId: string;
  status: number;
  durationMs: number;
  release: string | undefined;
  staleClient?: boolean;
}): RequestLog {
  const { pathname } = new URL(options.request.url);
  const kind = requestKind(pathname);
  const clientBuild = clientBuildOf(options.request.headers);
  return {
    event: "request",
    requestId: options.requestId,
    method: options.request.method,
    path: pathname,
    kind,
    ...(kind === "function"
      ? { operation: pathname.slice(serverFnPrefix.length).split("/")[0] }
      : {}),
    status: options.status,
    durationMs: options.durationMs,
    build: serverBuildId,
    release: options.release,
    ...(clientBuild === undefined ? {} : { clientBuild }),
    ...(options.staleClient === true ? { staleClient: true as const } : {}),
  };
}
