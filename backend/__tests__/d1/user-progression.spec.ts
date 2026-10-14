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

  it("clears PBs and tag PBs for one client, then removes shared tag history from both", async () => {
    await seedUser(test.env, "clearPbs");
    await withRuntime(test.env, async () => {
      const tag = await Users.addTag("clearPbs", "before");
      for (const client of ["web", "tui"] as const) {
        const user = await Users.getUser("clearPbs", "test");
        const result = scoreEvent(user.uid, 80, 0, { client, tags: [tag._id] });
        expect(await Users.checkIfPb(user.uid, user, result)).toBe(true);
        expect(await Users.checkIfTagPb(user.uid, user, result)).toEqual([
          tag._id,
        ]);
      }
      await Users.editTag("clearPbs", tag._id, "after");
      await Users.removeTagPb("clearPbs", tag._id, "tui");
      await Users.clearPb("clearPbs", "tui");
      expect(
        (await Users.getTags("clearPbs", "tui"))[0]?.personalBests.time,
      ).toEqual({});
      expect((await Users.getTags("clearPbs"))[0]).toMatchObject({
        name: "after",
        personalBests: { time: { 15: [{ wpm: 80 }] } },
      });
      expect(
        (await Users.getUser("clearPbs", "test", "tui")).personalBests.time,
      ).toEqual({});
      expect(
        await statement(
          "SELECT board FROM leaderboard_bests WHERE uid='clearPbs'",
        ).all<{ board: string }>(),
      ).toMatchObject({ results: [{ board: "english_time_15" }] });
      await Users.removeTagPb("clearPbs", tag._id);
      expect((await Users.getTags("clearPbs"))[0]?.personalBests.time).toEqual(
        {},
      );
      await Users.removeTag("clearPbs", tag._id);
      expect(await Users.getTags("clearPbs")).toEqual([]);
      expect(await Users.getTags("clearPbs", "tui")).toEqual([]);
      await expect(
        Users.editTag("clearPbs", tag._id, "missing"),
      ).rejects.toThrow("Tag not found");
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
      await Users.setStreakHourOffset("streakProgress", 5, "tui");
      await Users.setStreakHourOffset("streakProgress", -3);
      await Users.clearStreakHourOffset("streakProgress");
      expect(
        (await Users.getUser("streakProgress", "test")).streak?.hourOffset,
      ).toBeUndefined();
      expect(
        (await Users.getUser("streakProgress", "test", "tui")).streak
          ?.hourOffset,
      ).toBeUndefined();
    });
  });
});
