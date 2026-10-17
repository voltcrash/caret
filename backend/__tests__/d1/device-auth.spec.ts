import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import type { ExecutionContext } from "@cloudflare/workers-types";
import { createTestRuntime } from "./helpers";
import { withRuntime } from "../../src/runtime/env";
import { scheduled } from "../../src/runtime/tasks";
import { getAuth } from "../../src/init/auth";
import * as Users from "../../src/dal/user";
import Worker from "../__testData__/http-worker";

type DeviceCode = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  interval: number;
};
describe("D1 device authorization and native bearer access", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  let token: string;
  let uid: string;
  beforeAll(async () => {
    test = await createTestRuntime();
    test.env.BETTER_AUTH_URL = "http://localhost:5005/api/auth";
    test.env.BETTER_AUTH_SECRET =
      "device-test-secret-at-least-thirty-two-characters";
    await withRuntime(test.env, async () => {
      const ctx = await getAuth().$context;
      const user = await ctx.internalAdapter.createUser(
        { name: "Device", email: "device@example.test", emailVerified: true },
        { method: "oauth", oauth: { providerId: "github" } },
      );
      uid = user.id;
      await Users.addUser(user.name, user.email, uid);
      const session = await ctx.internalAdapter.createSession(uid, false);
      if (session === null) throw new Error("Missing session");
      token = session.token;
    });
  });
  afterAll(async () => await test?.dispose());
  async function request(
    path: string,
    body?: unknown,
    headers?: HeadersInit,
  ): Promise<Response> {
    return await Worker.fetch(
      new Request(`http://localhost:5005/api${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { "content-type": "application/json", ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      test.env,
      { waitUntil: () => undefined } as unknown as ExecutionContext,
    );
  }
  async function issue(): Promise<DeviceCode> {
    const response = await request("/auth/device/code", {
      client_id: "oxytype-tui",
    });
    expect(response.status, await response.clone().text()).toBe(200);
    return (await response.json()) as DeviceCode;
  }
  async function poll(
    code: DeviceCode,
    client_id = "oxytype-tui",
  ): Promise<Response> {
    return await request("/auth/device/token", {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: code.device_code,
      client_id,
    });
  }
  it("issues codes, claims/approves in the browser, and returns a usable bearer session", async () => {
    const code = await issue();
    expect(code.verification_uri).toBe("http://localhost:3000/device");
    expect(
      new URL(code.verification_uri_complete).searchParams.get("user_code"),
    ).toBe(code.user_code);
    expect(code.interval).toBe(5);
    const pending = await poll(code);
    expect(pending.status).toBe(400);
    expect(await pending.json()).toMatchObject({
      error: "authorization_pending",
    });
    const browser = {
      authorization: `Bearer ${token}`,
      origin: "http://localhost:3000",
    };
    const claim = await request(
      `/auth/device?user_code=${encodeURIComponent(code.user_code)}`,
      undefined,
      browser,
    );
    expect(claim.status, await claim.clone().text()).toBe(200);
    const approve = await request(
      "/auth/device/approve",
      { userCode: code.user_code },
      browser,
    );
    expect(approve.status, await approve.clone().text()).toBe(200);
    // Poll throttling is exercised below; advance this pending row's last poll.
    await test.env.DB.prepare(
      "UPDATE auth_device_codes SET last_polled_at=last_polled_at-6000 WHERE device_code=?",
    )
      .bind(code.device_code)
      .run();
    const response = await poll(code);
    expect(response.status, await response.clone().text()).toBe(200);
    const result = (await response.json()) as {
      access_token: string;
      token_type: string;
    };
    expect(result.token_type.toLowerCase()).toBe("bearer");
    const native = { authorization: `Bearer ${result.access_token}` };
    const profile = await request("/users?client=tui", undefined, native);
    expect(profile.status, await profile.clone().text()).toBe(200);
    expect(await profile.json()).toMatchObject({
      data: { uid, personalBests: { time: {} }, completedTests: 0 },
    });
    expect((await poll(code)).status).not.toBe(200);
    const logout = await request("/auth/sign-out", {}, native);
    expect(logout.status, await logout.clone().text()).toBe(200);
    expect((await request("/users", undefined, native)).status).toBe(401);
  });
  it("rejects unknown clients, throttles polling and observes denial and expiry", async () => {
    expect(
      (await request("/auth/device/code", { client_id: "unknown" })).status,
    ).toBe(400);
    const code = await issue();
    expect((await poll(code, "unknown")).status).toBe(400);
    await poll(code);
    expect(await (await poll(code)).json()).toMatchObject({
      error: "slow_down",
    });
    const browser = {
      authorization: `Bearer ${token}`,
      origin: "http://localhost:3000",
    };
    await request(
      `/auth/device?user_code=${encodeURIComponent(code.user_code)}`,
      undefined,
      browser,
    );
    expect(
      (
        await request(
          "/auth/device/deny",
          { userCode: code.user_code },
          browser,
        )
      ).status,
    ).toBe(200);
    await test.env.DB.prepare(
      "UPDATE auth_device_codes SET last_polled_at=0 WHERE device_code=?",
    )
      .bind(code.device_code)
      .run();
    expect(await (await poll(code)).json()).toMatchObject({
      error: "access_denied",
    });
    const expired = await issue();
    await test.env.DB.prepare(
      "UPDATE auth_device_codes SET expires_at=0 WHERE device_code=?",
    )
      .bind(expired.device_code)
      .run();
    expect(await (await poll(expired)).json()).toMatchObject({
      error: "expired_token",
    });
  });
  it("requires the owner who claimed a code to approve it", async () => {
    const code = await issue();
    const owner = {
      authorization: `Bearer ${token}`,
      origin: "http://localhost:3000",
    };
    expect(
      (
        await request(
          `/auth/device?user_code=${encodeURIComponent(code.user_code)}`,
          undefined,
          owner,
        )
      ).status,
    ).toBe(200);
    const otherToken = await withRuntime(test.env, async () => {
      const auth = await getAuth().$context;
      const user = await auth.internalAdapter.createUser(
        {
          name: "Other",
          email: "device-other@example.test",
          emailVerified: true,
        },
        { method: "oauth", oauth: { providerId: "github" } },
      );
      const session = await auth.internalAdapter.createSession(user.id, false);
      if (session === null) throw new Error("Missing session");
      return session.token;
    });
    const other = {
      authorization: `Bearer ${otherToken}`,
      origin: "http://localhost:3000",
    };
    expect(
      (
        await request(
          "/auth/device/approve",
          { userCode: code.user_code },
          other,
        )
      ).status,
    ).toBe(403);
    expect(
      (await request("/auth/device/deny", { userCode: code.user_code }, other))
        .status,
    ).toBe(403);
    expect(
      (
        await request(
          "/auth/device/approve",
          { userCode: code.user_code },
          owner,
        )
      ).status,
    ).toBe(200);
  });
  it("preserves browser origin checks and requires authenticated approval", async () => {
    const code = await issue();
    expect(
      (
        await request(
          "/auth/device/code",
          { client_id: "oxytype-tui" },
          { origin: "https://untrusted.test" },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          "/auth/device/approve",
          { userCode: code.user_code },
          { origin: "http://localhost:3000" },
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await request(
          "/auth/device/approve",
          { userCode: code.user_code },
          {
            authorization: `Bearer ${token}`,
            origin: "https://untrusted.test",
          },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          "/auth/sign-out",
          {},
          { cookie: "oxytype.session_token=invalid" },
        )
      ).status,
    ).toBe(403);
    const response = await request("/users", undefined, {
      authorization: `Bearer ${token}`,
      origin: "http://localhost:3000",
    });
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
  });
  it("cleans expired device codes while preserving pending live codes", async () => {
    const code = await issue();
    await test.env.DB.prepare(
      "INSERT INTO auth_device_codes(id,device_code,user_code,expires_at,status,client_id) VALUES('expired-cleanup','expired-cleanup','expired-cleanup',0,'pending','oxytype-tui')",
    ).run();
    await withRuntime(test.env, async () => await scheduled(3600000));
    expect(
      await test.env.DB.prepare(
        "SELECT id FROM auth_device_codes WHERE id='expired-cleanup'",
      ).first(),
    ).toBeNull();
    expect(
      await test.env.DB.prepare(
        "SELECT device_code FROM auth_device_codes WHERE device_code=?",
      )
        .bind(code.device_code)
        .first("device_code"),
    ).toBe(code.device_code);
  });
});
