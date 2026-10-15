import { afterAll, beforeAll, expect, it, vi } from "vite-plus/test";
import { createTestRuntime, seedUser } from "./helpers";
import { withRuntime, runtime, background } from "../../src/runtime/env";
import { getAuth } from "../../src/init/auth";
import { createNewUser } from "../../src/services/operations/user/account";
import { getCachedConfiguration } from "../../src/init/configuration";
import { verifySession } from "../../src/utils/auth";
import * as UserDAL from "../../src/dal/user";

let test: Awaited<ReturnType<typeof createTestRuntime>>;
const siteverify = vi.fn<typeof fetch>();

beforeAll(async () => {
  test = await createTestRuntime();
  test.env.BETTER_AUTH_URL = "http://localhost:5005/api/auth";
  test.env.BETTER_AUTH_SECRET =
    "local-test-secret-at-least-thirty-two-characters";
  test.env.TURNSTILE_SECRET_KEY = "private-turnstile-fixture";
  vi.stubGlobal("fetch", siteverify);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await test?.dispose();
});

async function onboarding(email: string): Promise<{
  context: Awaited<ReturnType<typeof getAuth>["$context"]>;
  user: { id: string; email: string };
  headers: Headers;
  signup: (name: string) => ReturnType<typeof createNewUser>;
}> {
  const context = await getAuth().$context;
  const user = await context.internalAdapter.createUser(
    { name: "Social", email, emailVerified: true },
    { method: "oauth", oauth: { providerId: "github" } },
  );
  await context.internalAdapter.createAccount({
    userId: user.id,
    providerId: "github",
    accountId: email,
  });
  const session = await context.internalAdapter.createSession(user.id, false);
  if (session === null) throw new Error("Missing session");
  const headers = new Headers({ authorization: `Bearer ${session.token}` });
  return {
    context,
    user,
    headers,
    signup: async (name: string) =>
      await createNewUser(
        {
          runtime: runtime(),
          requestId: "test-request",
          background,
          actor: { type: "Session", uid: user.id, email },
          configuration: await getCachedConfiguration(),
          client: { ip: "127.0.0.1" },
        },
        {
          body: { name, captcha: "opaque-token" },
          query: undefined,
          params: undefined,
        },
      ),
  };
}

it("preserves auth identity, provider and session after overlapping signups", async () => {
  await withRuntime(test.env, async () => {
    const { context, user, headers, signup } =
      await onboarding("race@example.com");
    const releases: (() => void)[] = [];
    siteverify.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        releases.push(resolve);
        if (releases.length === 2) releases.forEach((release) => release());
      });
      return Response.json({
        success: true,
        hostname: "localhost",
        action: "signup",
      });
    });
    const outcomes = await Promise.allSettled([
      signup("RaceOne"),
      signup("RaceTwo"),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      outcomes.find((outcome) => outcome.status === "rejected"),
    ).toMatchObject({
      reason: { status: 409 },
    });
    expect(await UserDAL.exists(user.id)).toBe(true);
    expect(await context.internalAdapter.findUserById(user.id)).not.toBeNull();
    expect(await context.internalAdapter.findAccounts(user.id)).toHaveLength(1);
    expect((await verifySession(headers)).uid).toBe(user.id);
  });
});

it("allows username conflicts to be retried in the same auth session", async () => {
  await seedUser(test.env, "occupied", "OccupiedName");
  await withRuntime(test.env, async () => {
    siteverify.mockImplementation(async () =>
      Response.json({
        success: true,
        hostname: "localhost",
        action: "signup",
      }),
    );
    const { user, headers, signup } = await onboarding("retry@example.com");
    await expect(signup("OccupiedName")).rejects.toMatchObject({ status: 409 });
    expect((await verifySession(headers)).uid).toBe(user.id);
    expect(await UserDAL.exists(user.id)).toBe(false);
    await signup("AvailableName");
    expect((await UserDAL.getUser(user.id, "signup retry")).name).toBe(
      "AvailableName",
    );
    expect((await verifySession(headers)).uid).toBe(user.id);
  });
});
