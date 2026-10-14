import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createTestRuntime, seedUser } from "./helpers";
import { scoreEvent } from "./result-support";
import { withRuntime } from "../../src/runtime/env";
import { statement } from "../../src/db/client";
import * as Users from "../../src/dal/user";
import type { CompletedEvent } from "@oxytype/schemas/results";

describe("D1 personal-best and progression policies", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  beforeAll(async () => {
    test = await createTestRuntime();
  });
  afterAll(async () => await test?.dispose());

  it.each([
    ["offline", { offline: true }],
    ["quote", { mode: "quote", mode2: "1" }],
    ["stop-on-letter error", { stopOnLetter: true, acc: 95 }],
  ] satisfies [string, Partial<CompletedEvent>][])(
    "excludes %s results from both user and tag PBs",
    async (name, changes) => {
      const uid = name.replaceAll(" ", "_");
      await seedUser(test.env, uid);
      await withRuntime(test.env, async () => {
        const tag = await Users.addTag(uid, "practice");
        const user = await Users.getUser(uid, "test");
        const result = scoreEvent(uid, 80, 0, { ...changes, tags: [tag._id] });
        expect(await Users.checkIfPb(uid, user, result)).toBe(false);
        expect(await Users.checkIfTagPb(uid, user, result)).toEqual([]);
        expect((await Users.getUser(uid, "test")).personalBests.time).toEqual(
          {},
        );
        expect((await Users.getTags(uid))[0]?.personalBests.time).toEqual({});
        expect(
          await statement(
            "SELECT count(*) AS n FROM leaderboard_bests WHERE uid=?",
            uid,
          ).first("n"),
        ).toBe(0);
      });
    },
  );
});
