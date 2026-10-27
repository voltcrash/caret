import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { createTestRuntime } from "./helpers";
import { withRuntime } from "../../src/runtime/env";
import { getAuth } from "../../src/init/auth";
import { verifySession } from "../../src/utils/auth";
import { patchConfiguration } from "../../src/init/configuration";
import * as UserDAL from "../../src/dal/user";
import Worker from "../__testData__/http-worker";
import { GetUserResponseSchema } from "@caret/contracts/users";
import type { ExecutionContext } from "@cloudflare/workers-types";

describe("Better Auth PostgreSQL adapter", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  const siteverify = vi.fn<typeof fetch>();
  beforeAll(async () => {
    test = await createTestRuntime();
    test.env.BETTER_AUTH_URL = "http://localhost:5005/api/auth";
    test.env.BETTER_AUTH_SECRET =
      "local-test-secret-at-least-thirty-two-characters";
    test.env.TURNSTILE_SECRET_KEY = "private-turnstile-fixture";
    siteverify.mockImplementation(async () =>
      Response.json({ success: true, hostname: "localhost", action: "signup" }),
    );
    vi.stubGlobal("fetch", siteverify);
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    await test?.dispose();
  });
  it("preserves a new social account and session through username onboarding", async () => {
    await withRuntime(test.env, async () => {
      const context = await getAuth().$context;
      const user = await context.internalAdapter.createUser(
        { name: "Social", email: "social@example.com", emailVerified: true },
        { method: "oauth", oauth: { providerId: "github" } },
      );
      await context.internalAdapter.createAccount({
        userId: user.id,
        providerId: "github",
        accountId: "social-github-account",
      });
      const session = await context.internalAdapter.createSession(
        user.id,
        false,
      );
      if (session === null) throw new Error("Missing session");
      const headers = new Headers({
        authorization: `Bearer ${session.token}`,
        origin: "http://localhost:3000",
        "content-type": "application/json",
      });
      const request = async (
        path: string,
        method = "GET",
        body?: unknown,
      ): Promise<Response> =>
        await Worker.fetch(
          new Request(`http://localhost:5005${path}`, {
            method,
            headers,
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          }),
          test.env,
          { waitUntil: () => undefined } as unknown as ExecutionContext,
        );
      await patchConfiguration({ users: { signUp: true } });

      // The frontend checks for a missing profile before opening username setup,
      // including after a refresh while onboarding is still unfinished.
      expect((await request("/users")).status).toBe(404);
      expect((await verifySession(headers)).uid).toBe(user.id);
      expect((await request("/api/users")).status).toBe(404);
      expect(await UserDAL.exists(user.id)).toBe(false);
      expect(
        await context.internalAdapter.findUserById(user.id),
      ).not.toBeNull();
      expect(await context.internalAdapter.findAccounts(user.id)).toHaveLength(
        1,
      );

      const availability = await request("/users/checkName/Social");
      expect(availability.status).toBe(200);
      expect(await availability.json()).toMatchObject({
        data: { available: true },
      });
      // Siteverify failure must preserve the real PostgreSQL-backed onboarding session.
      for (const data of [
        { success: false, "error-codes": ["timeout-or-duplicate"] },
        { success: true, hostname: "attacker.test", action: "signup" },
        { success: true, hostname: "localhost", action: "quote-submit" },
      ]) {
        siteverify.mockResolvedValueOnce(Response.json(data));
        expect(
          (
            await request("/users/signup", "POST", {
              name: "Social",
              captcha: "opaque-token",
            })
          ).status,
        ).toBe(422);
        expect((await verifySession(headers)).uid).toBe(user.id);
        expect(await UserDAL.exists(user.id)).toBe(false);
      }
      siteverify.mockRejectedValueOnce(new Error("Verification unavailable"));
      expect(
        (
          await request("/users/signup", "POST", {
            name: "Social",
            captcha: "opaque-token",
          })
        ).status,
      ).toBe(422);
      expect((await verifySession(headers)).uid).toBe(user.id);
      expect(
        (
          await request("/users/signup", "POST", {
            name: "Social",
            captcha: "opaque-token",
          })
        ).status,
      ).toBe(200);

      const profile = await request("/users");
      expect(profile.status).toBe(200);
      expect(
        GetUserResponseSchema.parse(await profile.json()).data,
      ).toMatchObject({
        uid: user.id,
        name: "Social",
        email: user.email,
      });
      expect((await verifySession(headers)).uid).toBe(user.id);

      expect(
        (
          await request("/users/signup", "POST", {
            name: "Social",
            captcha: "opaque-token",
          })
        ).status,
      ).toBe(409);
      expect((await verifySession(headers)).uid).toBe(user.id);
      expect(await UserDAL.exists(user.id)).toBe(true);
    });
  });
  it("persists sessions, rejects disabled users, and observes revocation", async () => {
    await withRuntime(test.env, async () => {
      const context = await getAuth().$context;
      const user = await context.internalAdapter.createUser(
        { name: "Auth", email: "auth@example.com", emailVerified: true },
        { method: "oauth", oauth: { providerId: "google" } },
      );
      const session = await context.internalAdapter.createSession(
        user.id,
        false,
      );
      expect(session).not.toBeNull();
      const headers = new Headers({
        authorization: `Bearer ${session?.token}`,
      });
      expect((await verifySession(headers)).uid).toBe(user.id);
      await context.internalAdapter.deleteSession(session?.token ?? "");
      await expect(verifySession(headers)).rejects.toThrow();
      await test.db.prepare("UPDATE auth_users SET disabled=true WHERE id=?")
        .bind(user.id)
        .run();
      await expect(
        context.internalAdapter.createSession(user.id, false),
      ).rejects.toThrow(/disabled/);
    });
  });

  it("revokes PostgreSQL sessions immediately on disable and never revives them on re-enable", async () => {
    await withRuntime(test.env, async () => {
      const context = await getAuth().$context;
      const user = await context.internalAdapter.createUser(
        { name: "Disable", email: "disable@example.test", emailVerified: true },
        { method: "oauth", oauth: { providerId: "github" } },
      );
      const first = await context.internalAdapter.createSession(user.id, false);
      const second = await context.internalAdapter.createSession(
        user.id,
        false,
      );
      if (first === null || second === null) {
        throw new Error("Missing fixture sessions");
      }
      await context.internalAdapter.updateUser(user.id, { disabled: true });
      for (const token of [first.token, second.token]) {
        expect(await context.internalAdapter.findSession(token)).toBeNull();
      }
      await expect(
        context.internalAdapter.createSession(user.id, false),
      ).rejects.toThrow(/disabled/);
      await context.internalAdapter.updateUser(user.id, { disabled: false });
      await expect(
        verifySession(new Headers({ authorization: `Bearer ${first.token}` })),
      ).rejects.toThrow(/expired or revoked/);
      const replacement = await context.internalAdapter.createSession(
        user.id,
        false,
      );
      if (replacement === null) throw new Error("Missing replacement session");
      expect(
        (
          await verifySession(
            new Headers({ authorization: `Bearer ${replacement.token}` }),
          )
        ).uid,
      ).toBe(user.id);
    });
  });
});
