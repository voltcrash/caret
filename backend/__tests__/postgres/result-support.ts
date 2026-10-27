import type { ExecutionContext } from "@cloudflare/workers-types";
import type { CompletedEvent } from "@caret/schemas/results";
import objectHash from "object-hash";
import { createTestRuntime } from "./helpers";
import { withRuntime } from "../../src/runtime/env";
import { getAuth } from "../../src/init/auth";
import { patchConfiguration } from "../../src/init/configuration";
import * as Users from "../../src/dal/user";
import { mutateUser } from "../../src/db/mutation";
import { completedEvent } from "../__testData__/completed-event";
import { consistency } from "../../src/anticheat/result";
import Worker from "../__testData__/http-worker";

type Account = { uid: string; token: string };
type ResultRuntime = Awaited<ReturnType<typeof createTestRuntime>> & {
  account: () => Promise<Account>;
  request: (
    account: Pick<Account, "token">,
    path: string,
    method?: string,
    body?: unknown,
  ) => Promise<Response>;
  submit: (
    account: Account,
    changes?: Partial<CompletedEvent>,
    salt?: number,
  ) => Promise<Response>;
};

export async function resultRuntime(): Promise<ResultRuntime> {
  const test = await createTestRuntime();
  test.env.MODE = "production";
  test.env.BETTER_AUTH_URL = "http://localhost:5005/api/auth";
  test.env.BETTER_AUTH_SECRET =
    "result-test-secret-at-least-thirty-two-characters";
  await withRuntime(
    test.env,
    async () =>
      await patchConfiguration({
        results: { savingEnabled: true, objectHashCheckEnabled: true },
        users: { xp: { enabled: true } },
        dailyLeaderboards: { enabled: true },
        leaderboards: { minTimeTyping: 0, weeklyXp: { enabled: true } },
      }),
  );
  let index = 0;
  async function account(): Promise<Account> {
    return await withRuntime(test.env, async () => {
      const auth = await getAuth().$context;
      const number = index++;
      const user = await auth.internalAdapter.createUser(
        {
          name: `Result${number}`,
          email: `result${number}@example.test`,
          emailVerified: true,
        },
        { method: "oauth", oauth: { providerId: "github" } },
      );
      await Users.addUser(user.name, user.email, user.id);
      await mutateUser(user.id, (profile) => {
        profile.addedAt = 0;
        profile.timeTyping = 1;
      });
      const session = await auth.internalAdapter.createSession(user.id, false);
      if (session === null) throw new Error("Missing session");
      return { uid: user.id, token: session.token };
    });
  }
  async function request(
    account: { token: string },
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<Response> {
    return await Worker.fetch(
      new Request(`http://localhost:5005/api${path}`, {
        method,
        headers: {
          authorization: `Bearer ${account.token}`,
          "content-type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      test.env,
      { waitUntil: () => undefined } as unknown as ExecutionContext,
    );
  }
  async function submit(
    account: { uid: string; token: string },
    changes: Partial<CompletedEvent> = {},
    salt = 0,
  ): Promise<Response> {
    const result = scoreEvent(account.uid, 80, salt, changes);
    const { hash: _hash, ...payload } = result;
    return await request(account, "/results", "POST", {
      result: { ...payload, hash: objectHash(payload) },
    });
  }
  return { ...test, account, request, submit };
}

export function scoreEvent(
  uid: string,
  wpm: number,
  salt = 0,
  changes: Partial<CompletedEvent> = {},
): CompletedEvent {
  const correct = (wpm * 5) / 4;
  const total = correct + 10;
  const keySpacing = Array.from(
    { length: total - 1 },
    (_, i) => 90 + (i % (7 + salt)) * 5,
  );
  return completedEvent({
    uid,
    wpm,
    rawWpm: total * 0.8,
    mode2: "15",
    testDuration: 15,
    charStats: [correct, 5, 3, 2],
    charTotal: total,
    keySpacing,
    keyDuration: Array.from({ length: total }, (_, i) => 40 + (i % 5) * 7),
    keyConsistency: consistency(keySpacing.slice(0, -1)),
    lastKeyToEnd: 15000 - keySpacing.reduce((sum, value) => sum + value, 0),
    chartData: { wpm: [wpm], burst: [wpm], err: [0] },
    consistency: 100,
    wpmConsistency: 100,
    ...changes,
  });
}
