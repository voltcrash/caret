import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import {
  COMPATIBILITY_CHECK,
  COMPATIBILITY_CHECK_HEADER,
} from "@oxytype/contracts";

import { BASE_CONFIGURATION } from "../../src/constants/base-configuration";
import * as UserDal from "../../src/dal/user";
import * as Configuration from "../../src/init/configuration";
import { dispatchApi } from "../__testData__/http-worker";
import { createTestClient, type TestClient } from "../__testData__/test-client";

// Transport-independent HTTP behaviour of the handlers Start mounts under
// /api. CORS, security headers and request bodies belong to Start's Worker
// and are covered by frontend/__tests__/start/http.spec.ts.
let configuration = structuredClone(BASE_CONFIGURATION);
beforeEach(() => {
  vi.stubEnv("FRONTEND_URL", "http://localhost:3000");
  configuration = structuredClone(BASE_CONFIGURATION);
  vi.spyOn(Configuration, "getCachedConfiguration").mockResolvedValue(
    configuration,
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const client = (): TestClient => createTestClient(dispatchApi);

describe("HTTP operation handler", () => {
  it("serves health with the compatibility header", async () => {
    const response = await client().get("/").expect(200);
    expect(response.body).toEqual({
      message: "ok",
      data: { uptime: expect.any(Number), version: expect.any(String) },
    });
    expect(response.headers[COMPATIBILITY_CHECK_HEADER.toLowerCase()]).toBe(
      String(COMPATIBILITY_CHECK),
    );
  });

  it("uses the existing unknown-route envelope", async () => {
    const response = await client().get("/unknown?query=1").expect(404);
    expect(response.body).toEqual({
      message: "Unknown request URL (GET: /unknown)",
      data: null,
    });
  });

  it("keeps configuration available during maintenance", async () => {
    configuration.maintenance = true;
    const down = await client().get("/").expect(503);
    expect(down.body.message).toBe("Server is down for maintenance");
    await client().get("/configuration").expect(200);
  });

  it("honors environment maintenance", async () => {
    vi.stubEnv("MAINTENANCE", "true");
    await client().get("/psas").expect(503);
  });

  it("keeps compatibility-prefixed weak ETags and handles conditional requests", async () => {
    const response = await client().get("/configuration").expect(200);
    const etag = response.headers["etag"] as string;
    expect(etag).toMatch(new RegExp(`^W/"V${COMPATIBILITY_CHECK}-`));
    for (const tag of [etag, etag.replace(/^W\//, ""), `"other", ${etag}`]) {
      const cached = await client()
        .get("/configuration")
        .set("If-None-Match", tag)
        .expect(304);
      expect(cached.text).toBe("");
    }
    await client()
      .get("/configuration")
      .set("If-None-Match", 'W/"V0-stale"')
      .expect(200);
  });

  it("checks authentication before schema validation", async () => {
    await client().post("/presets").send({ invalid: true }).expect(401);
  });

  it("accepts trailing slashes on contract routes", async () => {
    await client().get("/configuration/").expect(200);
    await client().post("/presets/").expect(401);
  });

  it("hides unexpected error details behind an error ID", async () => {
    vi.spyOn(UserDal, "isNameAvailable").mockRejectedValue(
      new Error("private error details"),
    );
    const response = await client().get("/users/checkName/someone").expect(500);
    expect(response.body.data.errorId).toEqual(expect.any(String));
    expect(response.body.message).toContain(response.body.data.errorId);
    expect(response.text).not.toContain("private error details");
  });

  it("applies bad-auth penalties to later requests", async () => {
    configuration.rateLimiting.badAuthentication.enabled = true;
    configuration.rateLimiting.badAuthentication.flaggedStatusCodes = [401];
    configuration.rateLimiting.badAuthentication.penalty = 30 * 1000;
    await client()
      .get("/users")
      .set("CF-Connecting-IP", "192.0.2.20")
      .expect(401);
    const response = await client()
      .get("/configuration")
      .set("CF-Connecting-IP", "192.0.2.20")
      .expect(429);
    expect(response.body.message).toContain(
      "Too many bad authentication attempts",
    );
  });

  it.each([
    ["get", "/connections"],
    ["post", "/connections"],
    ["patch", "/connections/removed"],
    ["delete", "/connections/removed"],
    ["get", "/users/friends"],
    ["get", "/users/discord/oauth"],
    ["post", "/users/discord/link"],
    ["post", "/users/discord/unlink"],
    ["post", "/webhooks/githubRelease"],
    ["get", "/stats"],
    ["get", "/stats/metrics"],
  ] as const)("returns 404 for retired %s %s", async (method, path) => {
    const response = await client()
      [method](path)
      .set("Authorization", "Bearer retired-client")
      .expect(404);
    expect(response.body.data).toBeNull();
  });
});
