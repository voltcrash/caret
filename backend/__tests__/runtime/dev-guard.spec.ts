import { describe, expect, it } from "vite-plus/test";
import {
  devModeViolationResponse,
  isAllowedDevRequest,
  isLoopbackHost,
} from "../../src/runtime/dev-guard";

describe("isLoopbackHost", () => {
  it.each([
    "localhost",
    "LOCALHOST",
    "app.localhost",
    "a.b.localhost",
    "127.0.0.1",
    "127.0.0.2",
    "127.255.255.254",
    "[::1]",
    "::1",
  ])("accepts loopback hostname %s", (hostname) => {
    expect(isLoopbackHost(hostname)).toBe(true);
  });

  it.each([
    "",
    "   ",
    ".localhost",
    "localhost.evil.com",
    "evil-localhost",
    "0.0.0.0",
    "127.256.0.1",
    "127.01.0.1",
    "127.0.0.1.evil.com",
    "192.168.1.1",
    "[::ffff:127.0.0.1]",
    "caret.voltcrash.com",
    "caret-start-migration.voltcrash.workers.dev",
    "caret-api-staging.voltcrash.workers.dev",
  ])("rejects non-loopback hostname %s", (hostname) => {
    expect(isLoopbackHost(hostname)).toBe(false);
  });
});

describe("isAllowedDevRequest", () => {
  it.each([
    "http://localhost:3000/api/configuration",
    "http://127.0.0.1:8787/api/users",
    "http://[::1]:3000/api/configure",
    "http://app.localhost:3000/",
  ])("allows loopback request %s", (url) => {
    expect(isAllowedDevRequest(new Request(url))).toBe(true);
  });

  it("allows loopback Host and Origin headers", () => {
    const request = new Request("http://localhost:3000/api/configuration", {
      headers: {
        host: "localhost:3000",
        origin: "http://127.0.0.1:5173",
      },
    });
    expect(isAllowedDevRequest(request)).toBe(true);
  });

  it.each([
    "https://caret-start-migration.voltcrash.workers.dev/api/configuration",
    "https://caret.voltcrash.com/api/users",
    "https://localhost.evil.com/api/configure",
  ])("rejects non-loopback request URL %s", (url) => {
    expect(isAllowedDevRequest(new Request(url))).toBe(false);
  });

  it.each([
    "caret.voltcrash.com",
    "caret-start-migration.voltcrash.workers.dev",
    "evil.com@localhost:3000",
    "localhost:3000/path",
    "invalid host",
  ])("rejects non-loopback or spoofed Host header %s", (host) => {
    const request = new Request("http://localhost:3000/api/configuration", {
      headers: { host },
    });
    expect(isAllowedDevRequest(request)).toBe(false);
  });

  it.each([
    "https://attacker.example",
    "https://caret-start-migration.voltcrash.workers.dev",
    "null",
    "not-a-url",
  ])("rejects non-loopback or invalid Origin header %s", (origin) => {
    const request = new Request("http://localhost:3000/api/configuration", {
      method: "PATCH",
      headers: { origin },
    });
    expect(isAllowedDevRequest(request)).toBe(false);
  });
});

describe("devModeViolationResponse", () => {
  it("fails closed with 403 and no-store when MODE=dev serves a public host", async () => {
    const request = new Request(
      "https://caret-start-migration.voltcrash.workers.dev/api/configuration",
    );
    const response = devModeViolationResponse(request, "dev");
    expect(response).toBeDefined();
    expect(response?.status).toBe(403);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
    expect(await response?.text()).toContain("loopback");
  });

  it("allows loopback requests in MODE=dev", () => {
    const request = new Request("http://localhost:3000/api/configuration");
    expect(devModeViolationResponse(request, "dev")).toBeUndefined();
  });

  it.each(["production", "staging", undefined])(
    "leaves non-loopback hosts untouched when MODE=%s",
    (mode) => {
      const request = new Request(
        "https://caret-api-staging.voltcrash.workers.dev/api/configuration",
        {
          headers: {
            host: "caret-api-staging.voltcrash.workers.dev",
            origin: "https://caret-api-staging.voltcrash.workers.dev",
          },
        },
      );
      expect(devModeViolationResponse(request, mode)).toBeUndefined();
    },
  );
});
