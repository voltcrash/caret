import { describe, expect, it } from "vite-plus/test";
import {
  clientBuildOf,
  requestKind,
  requestLog,
} from "../../src/server/observability.server";

function request(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://oxytype.test${path}`, {
    method: "POST",
    headers,
  });
}

describe("request observability", () => {
  it.each([
    ["/_serverFn/abc123", "function"],
    ["/api/auth/get-session", "auth"],
    ["/api/auth", "auth"],
    ["/api/results", "api"],
    ["/api", "api"],
    ["/apiary", "document"],
    ["/settings", "document"],
  ])("classifies %s as %s", (path, kind) => {
    expect(requestKind(path)).toBe(kind);
  });

  it("joins request, release and client build without query strings or bodies", () => {
    const log = requestLog({
      request: request("/_serverFn/f00d/extra?payload=secret-result", {
        "X-Client-Version": "2026.10.16_08.17_abc1234",
        cookie: "oxytype.session_token=secret",
      }),
      requestId: "request-1",
      status: 200,
      durationMs: 4,
      release: "26.10.16",
    });
    expect(log).toMatchObject({
      event: "request",
      path: "/_serverFn/f00d/extra",
      kind: "function",
      operation: "f00d",
      release: "26.10.16",
      clientBuild: "2026.10.16_08.17_abc1234",
    });
    expect(log).not.toHaveProperty("staleClient");
    expect(JSON.stringify(log)).not.toContain("secret");
  });

  it("marks stale clients and never echoes an unsafe client header", () => {
    expect(clientBuildOf(new Headers({ "X-Client-Version": "<script>" }))).toBe(
      "invalid",
    );
    expect(clientBuildOf(new Headers())).toBeUndefined();
    const log = requestLog({
      request: request("/api/results"),
      requestId: "request-2",
      status: 409,
      durationMs: 1,
      release: undefined,
      staleClient: true,
    });
    expect(log).toMatchObject({ kind: "api", staleClient: true });
    expect(log).not.toHaveProperty("operation");
    expect(log).not.toHaveProperty("clientBuild");
  });
});
