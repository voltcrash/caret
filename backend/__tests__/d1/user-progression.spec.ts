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

  it("clears PBs and tag PBs, then removes tag history", async () => {
    await seedUser(test.env, "clearPbs");
    await withRuntime(test.env, async () => {
      const tag = await Users.addTag("clearPbs", "before");
      const user = await Users.getUser("clearPbs", "test");
      const result = scoreEvent(user.uid, 80, 0, { tags: [tag._id] });
      expect(await Users.checkIfPb(user.uid, user, result)).toBe(true);
      expect(await Users.checkIfTagPb(user.uid, user, result)).toEqual([
        tag._id,
      ]);
      await Users.editTag(user.uid, tag._id, "after");
      await Users.removeTagPb(user.uid, tag._id);
      await Users.clearPb(user.uid);
      expect((await Users.getTags(user.uid))[0]).toMatchObject({
        name: "after",
        personalBests: { time: {} },
      });
      expect(
        (await Users.getUser(user.uid, "test")).personalBests.time,
      ).toEqual({});
      expect(
        await statement(
          "SELECT count(*) AS n FROM leaderboard_bests WHERE uid=?",
          user.uid,
        ).first("n"),
      ).toBe(0);
      await Users.removeTag(user.uid, tag._id);
      expect(await Users.getTags(user.uid)).toEqual([]);
      await expect(Users.editTag(user.uid, tag._id, "missing")).rejects.toThrow(
        "Tag not found",
      );
    });
  });
  it("advances UTC streaks once per day, preserves the maximum and ignores delayed uploads", async () => {
    await seedUser(test.env, "streakProgress");
    await withRuntime(test.env, async () => {
      const day = Date.UTC(2024, 1, 28, 12);
      expect(await Users.updateStreak("streakProgress", day)).toBe(1);
      expect(await Users.updateStreak("streakProgress", day + 1000)).toBe(1);
      expect(await Users.updateStreak("streakProgress", day + 86400000)).toBe(
        2,
      );
      expect(await Users.updateStreak("streakProgress", day)).toBe(2);
      expect(
        await Users.updateStreak("streakProgress", day + 3 * 86400000),
      ).toBe(1);
      expect(
        (await Users.getUser("streakProgress", "test")).streak,
      ).toMatchObject({
        length: 1,
        maxLength: 2,
        lastResultTimestamp: day + 3 * 86400000,
      });
      await Users.setStreakHourOffset("streakProgress", -3);
      await Users.clearStreakHourOffset("streakProgress");
      expect(
        (await Users.getUser("streakProgress", "test")).streak?.hourOffset,
      ).toBeUndefined();
    });
  });

  it("awards bananas at the 60-second PB threshold and records leap-day activity", async () => {
    await seedUser(test.env, "bananasProgress");
    await withRuntime(test.env, async () => {
      let user = await Users.getUser("bananasProgress", "test");
      await Users.incrementBananas(user.uid, 100);
      expect((await Users.getUser(user.uid, "test")).bananas).toBeUndefined();
      await Users.checkIfPb(
        user.uid,
        user,
        scoreEvent(user.uid, 80, 0, { mode2: "60" }),
      );
      await Users.incrementBananas(user.uid, 59);
      await Users.incrementBananas(user.uid, 60);
      expect((await Users.getUser(user.uid, "test")).bananas).toBe(1);
      user = await Users.getUser(user.uid, "test");
      const day = Date.UTC(2024, 1, 29, 12);
      await Users.incrementTestActivity(user, day);
      await Users.incrementTestActivity(user, day);
      expect(
        (await Users.getUser(user.uid, "test")).testActivity?.[2024]?.[59],
      ).toBe(2);
      expect(
        await statement(
          "SELECT count FROM user_activity WHERE uid=? AND day=?",
          user.uid,
          Math.floor(day / 86400000),
        ).first("count"),
      ).toBe(2);
    });
  });
});
