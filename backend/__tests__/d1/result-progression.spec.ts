import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { resultRuntime, scoreEvent } from "./result-support";
import { withRuntime } from "../../src/runtime/env";
import { statement } from "../../src/db/client";
import * as Users from "../../src/dal/user";
import { AddResultResponseSchema } from "@oxytype/contracts/results";

describe("result PBs, rankings and progression with D1", () => {
  let test: Awaited<ReturnType<typeof resultRuntime>>;
  beforeAll(async () => {
    test = await resultRuntime();
  });
  afterAll(async () => await test?.dispose());

  it("retains best scores while every accepted result advances XP, activity and committed ranks", async () => {
    const account = await test.account();
    const rival = await test.account();
    const tag = await withRuntime(
      test.env,
      async () => await Users.addTag(account.uid, "practice"),
    );
    const gains: number[] = [];
    for (const [wpm, salt, isPb] of [
      [80, 1, true],
      [72, 2, false],
      [96, 3, true],
    ] as const) {
      const response = await test.submit(account, {
        ...scoreEvent(account.uid, wpm, salt),
        tags: [tag._id],
      });
      expect(response.status, await response.clone().text()).toBe(200);
      const data = AddResultResponseSchema.parse(await response.json()).data;
      gains.push(data.xp);
      expect(data.isPb).toBe(isPb);
      expect(data.tagPbs).toEqual(isPb ? [tag._id] : []);
      expect(data.weeklyXpLeaderboardRank).toBe(1);
      if (wpm !== 72) expect(data.dailyLeaderboardRank).toBe(1);
      if (wpm === 80) {
        const competitor = await test.submit(
          rival,
          scoreEvent(rival.uid, 88, 4),
        );
        expect(competitor.status, await competitor.clone().text()).toBe(200);
        expect(
          AddResultResponseSchema.parse(await competitor.json()).data
            .dailyLeaderboardRank,
        ).toBe(1);
      }
      await test.env.DB.prepare(
        "UPDATE results SET timestamp=timestamp-120000 WHERE uid=?",
      )
        .bind(account.uid)
        .run();
    }
    await withRuntime(test.env, async () => {
      const profile = await Users.getUser(account.uid, "test");
      expect(profile.personalBests.time[15]).toHaveLength(1);
      expect(profile.personalBests.time[15]?.[0]?.wpm).toBe(96);
      expect(
        (await Users.getTags(account.uid))[0]?.personalBests.time[15]?.[0]?.wpm,
      ).toBe(96);
      expect(profile.completedTests).toBe(3);
      expect(profile.startedTests).toBe(3);
      expect(profile.timeTyping).toBe(46);
      expect(profile.xp).toBe(gains.reduce((sum, xp) => sum + xp, 0));
      expect(
        await statement(
          "SELECT wpm FROM leaderboard_bests WHERE uid=? AND board='english_time_15'",
          account.uid,
        ).first("wpm"),
      ).toBe(96);
      expect(
        await statement(
          "SELECT sum(count) AS n FROM user_activity WHERE uid=?",
          account.uid,
        ).first("n"),
      ).toBe(3);
      expect(
        await statement(
          "SELECT json_extract(data,'$.wpm') FROM daily_entries WHERE uid=?",
          account.uid,
        ).first(),
      ).toEqual({ "json_extract(data,'$.wpm')": 96 });
    });
    const stats = await test.request(account, "/users/stats");
    expect(await stats.json()).toMatchObject({
      data: { completedTests: 3, startedTests: 3, timeTyping: 46 },
    });
    const pbs = await test.request(
      account,
      "/users/personalBests?mode=time&mode2=15",
    );
    expect(await pbs.json()).toMatchObject({ data: [{ wpm: 96 }] });
  });
});
