import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vite-plus/test";
import { setup } from "../../__testData__/controller-test";
import * as Configuration from "../../../src/init/configuration";
import * as ResultDal from "../../../src/dal/result";
import * as UserDal from "../../../src/dal/user";
import * as PublicDal from "../../../src/dal/public";
import * as LogsDal from "../../../src/dal/logs";
import * as WeeklyXpLeaderboardModule from "../../../src/services/weekly-xp-leaderboard";
import { WeeklyXpLeaderboard } from "../../../src/services/weekly-xp-leaderboard";
import * as DailyLeaderboards from "../../../src/utils/daily-leaderboards";
import { DailyLeaderboard } from "../../../src/utils/daily-leaderboards";
import { newId } from "../../../src/utils/id";
import { mockAuthenticateWithApeKey } from "../../__testData__/auth";
import { enableRateLimitExpects } from "../../__testData__/rate-limit";
import { DBResult } from "../../../src/utils/result";
import { omit } from "../../../src/utils/misc";
import { CompletedEvent } from "@oxytype/schemas/results";
import MonkeyError from "../../../src/utils/error";
import objectHash from "object-hash";
import { BASE_CONFIGURATION } from "../../../src/constants/base-configuration";
import { consistency } from "../../../src/anticheat/result";
import { getTimingFingerprint } from "../../../src/anticheat/replay";
import { completedEvent as typedEvent } from "../../__testData__/completed-event";

const { mockApp, uid } = setup();
const configuration = Configuration.getCachedConfiguration();
enableRateLimitExpects();

describe("result controller test", () => {
  const addLogMock = vi.spyOn(LogsDal, "addLog");
  const addImportantLogMock = vi.spyOn(LogsDal, "addImportantLog");

  beforeEach(() => {
    addLogMock.mockClear().mockResolvedValue();
    addImportantLogMock.mockClear().mockResolvedValue();
  });

  describe("getResults", () => {
    const resultMock = vi.spyOn(ResultDal, "getResults");

    beforeEach(async () => {
      resultMock.mockResolvedValue([]);
      await enablePremiumFeatures(true);
      vi.spyOn(UserDal, "checkIfUserIsPremium").mockResolvedValue(false);
    });

    afterEach(() => {
      resultMock.mockClear();
    });

    it("should get results", async () => {
      //GIVEN
      const resultOne = givenDbResult(uid);
      const resultTwo = givenDbResult(uid);
      resultMock.mockResolvedValue([resultOne, resultTwo]);

      //WHEN
      const { body } = await mockApp
        .get("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send()
        .expect(200);

      //THEN

      expect(body.message).toEqual("Results retrieved");
      expect(body.data).toEqual([
        { ...resultOne, _id: resultOne._id },
        { ...resultTwo, _id: resultTwo._id },
      ]);
    });
    it("should get results with ape key", async () => {
      //GIVEN
      await acceptApeKeys(true);
      const apeKey = await mockAuthenticateWithApeKey(uid, await configuration);

      //WHEN
      await mockApp
        .get("/results")
        .set("Authorization", `ApeKey ${apeKey}`)
        .send()
        .expect(200);
    });
    it("should get latest 1000 results for regular user", async () => {
      //WHEN
      await mockApp
        .get("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send()
        .expect(200);

      //THEN
      expect(resultMock).toHaveBeenCalledWith(uid, {
        limit: 1000,
        offset: 0,
        onOrAfterTimestamp: NaN,
      });
    });
    it("should get results filter by onOrAfterTimestamp", async () => {
      //GIVEN
      const now = Date.now();
      //WHEN
      await mockApp
        .get("/results")
        .query({ onOrAfterTimestamp: now })
        .set("Authorization", `Bearer ${uid}`)
        .send()
        .expect(200);

      //THEN

      expect(resultMock).toHaveBeenCalledWith(uid, {
        limit: 1000,
        offset: 0,
        onOrAfterTimestamp: now,
      });
    });
    it("should get with limit and offset", async () => {
      //WHEN
      await mockApp
        .get("/results")
        .query({ limit: 250, offset: 500 })
        .set("Authorization", `Bearer ${uid}`)
        .send()
        .expect(200);

      //THEN
      expect(resultMock).toHaveBeenCalledWith(uid, {
        limit: 250,
        offset: 500,
        onOrAfterTimestamp: NaN,
      });
    });
    it("should fail exceeding max limit for regular user", async () => {
      //WHEN
      const { body } = await mockApp
        .get("/results")
        .query({ limit: 100, offset: 1000 })
        .set("Authorization", `Bearer ${uid}`)
        .send()
        .expect(422);

      //THEN
      expect(body.message).toEqual(
        `Max results limit of ${
          (await configuration).results.limits.regularUser
        } exceeded.`,
      );
    });
    it("should get with higher max limit for premium user", async () => {
      //GIVEN
      vi.spyOn(UserDal, "checkIfUserIsPremium").mockResolvedValue(true);

      //WHEN
      await mockApp
        .get("/results")
        .query({ limit: 800, offset: 600 })
        .set("Authorization", `Bearer ${uid}`)
        .send()
        .expect(200);

      //THEN

      expect(resultMock).toHaveBeenCalledWith(uid, {
        limit: 800,
        offset: 600,
        onOrAfterTimestamp: NaN,
      });
    });
    it("should get results if offset/limit is partly outside the max limit", async () => {
      //WHEN
      await mockApp
        .get("/results")
        .query({ limit: 20, offset: 990 })
        .set("Authorization", `Bearer ${uid}`)
        .send()
        .expect(200);

      //THEN

      expect(resultMock).toHaveBeenCalledWith(uid, {
        limit: 10, //limit is reduced to stay within max limit
        offset: 990,
        onOrAfterTimestamp: NaN,
      });
    });
    it("should fail exceeding 1k limit", async () => {
      //GIVEN
      vi.spyOn(UserDal, "checkIfUserIsPremium").mockResolvedValue(false);

      //WHEN
      const { body } = await mockApp
        .get("/results")
        .query({ limit: 2000 })
        .set("Authorization", `Bearer ${uid}`)
        .send()
        .expect(422);

      //THEN
      expect(body).toEqual({
        message: "Invalid query schema",
        validationErrors: ['"limit" Number must be less than or equal to 1000'],
      });
    });
    it("should fail exceeding maxlimit for premium user", async () => {
      //GIVEN
      vi.spyOn(UserDal, "checkIfUserIsPremium").mockResolvedValue(true);

      //WHEN
      const { body } = await mockApp
        .get("/results")
        .query({ limit: 1000, offset: 25000 })
        .set("Authorization", `Bearer ${uid}`)
        .send()
        .expect(422);
      //THEN
      expect(body.message).toEqual(
        `Max results limit of ${
          (await configuration).results.limits.premiumUser
        } exceeded.`,
      );
    });
    it("should get results within regular limits for premium users even if premium is globally disabled", async () => {
      //GIVEN
      vi.spyOn(UserDal, "checkIfUserIsPremium").mockResolvedValue(true);
      await enablePremiumFeatures(false);

      //WHEN
      await mockApp
        .get("/results")
        .query({ limit: 100, offset: 900 })
        .set("Authorization", `Bearer ${uid}`)
        .send()
        .expect(200);

      //THEN
      expect(resultMock).toHaveBeenCalledWith(uid, {
        limit: 100,
        offset: 900,
        onOrAfterTimestamp: NaN,
      });
    });
    it("should fail exceeding max limit for premium user if premium is globally disabled", async () => {
      //GIVEN
      vi.spyOn(UserDal, "checkIfUserIsPremium").mockResolvedValue(true);
      await enablePremiumFeatures(false);

      //WHEN
      const { body } = await mockApp
        .get("/results")
        .query({ limit: 200, offset: 900 })
        .set("Authorization", `Bearer ${uid}`)
        .send()
        .expect(503);

      //THEN
      expect(body.message).toEqual("Premium feature disabled.");
    });
    it("should get results with regular limit as default for premium users if premium is globally disabled", async () => {
      //GIVEN
      vi.spyOn(UserDal, "checkIfUserIsPremium").mockResolvedValue(true);
      await enablePremiumFeatures(false);

      //WHEN
      await mockApp
        .get("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send()
        .expect(200);

      //THEN
      expect(resultMock).toHaveBeenCalledWith(uid, {
        limit: 1000, //the default limit for regular users
        offset: 0,
        onOrAfterTimestamp: NaN,
      });
    });
    it("should fail with unknown query parameters", async () => {
      //WHEN
      const { body } = await mockApp
        .get("/results")
        .query({ extra: "value" })
        .set("Authorization", `Bearer ${uid}`)
        .send()
        .expect(422);

      //THEN
      expect(body).toEqual({
        message: "Invalid query schema",
        validationErrors: ["Unrecognized key(s) in object: 'extra'"],
      });
    });
    it("should be rate limited", async () => {
      await expect(
        mockApp.get("/results").set("Authorization", `Bearer ${uid}`),
      ).toBeRateLimited({ max: 60, windowMs: 60 * 60 * 1000 });
    });
    it("should be rate limited for ape keys", async () => {
      //GIVEN
      await acceptApeKeys(true);
      const apeKey = await mockAuthenticateWithApeKey(uid, await configuration);

      //WHEN
      await expect(
        mockApp.get("/results").set("Authorization", `ApeKey ${apeKey}`),
      ).toBeRateLimited({ max: 30, windowMs: 24 * 60 * 60 * 1000 });
    });
  });
  describe("getResultById", () => {
    const getResultMock = vi.spyOn(ResultDal, "getResult");

    afterEach(() => {
      getResultMock.mockClear();
    });

    it("should get result", async () => {
      //GIVEN
      const result = givenDbResult(uid);
      getResultMock.mockResolvedValue(result);

      //WHEN
      const { body } = await mockApp
        .get(`/results/id/${result._id}`)
        .set("Authorization", `Bearer ${uid}`)
        .send()
        .expect(200);

      //THEN
      expect(body.message).toEqual("Result retrieved");
      expect(body.data).toEqual({ ...result, _id: result._id });
    });
    it("should get last result with ape key", async () => {
      //GIVEN
      await acceptApeKeys(true);
      const apeKey = await mockAuthenticateWithApeKey(uid, await configuration);
      const result = givenDbResult(uid);
      getResultMock.mockResolvedValue(result);

      //WHEN
      await mockApp
        .get(`/results/id/${result._id}`)
        .set("Authorization", `ApeKey ${apeKey}`)
        .send()
        .expect(200);
    });
    it("should rate limit get  result with ape key", async () => {
      //GIVEN
      const result = givenDbResult(uid, {
        charStats: undefined,
        incorrectChars: 5,
        correctChars: 12,
      });
      getResultMock.mockResolvedValue(result);
      await acceptApeKeys(true);
      const apeKey = await mockAuthenticateWithApeKey(uid, await configuration);

      //WHEN
      await expect(
        mockApp
          .get(`/results/id/${result._id}`)
          .set("Authorization", `ApeKey ${apeKey}`),
      ).toBeRateLimited({ max: 60, windowMs: 60 * 60 * 1000 });
    });
  });
  describe("getLastResult", () => {
    const getLastResultMock = vi.spyOn(ResultDal, "getLastResult");

    afterEach(() => {
      getLastResultMock.mockClear();
    });

    it("should get last result", async () => {
      //GIVEN
      const result = givenDbResult(uid);
      getLastResultMock.mockResolvedValue(result);

      //WHEN
      const { body } = await mockApp
        .get("/results/last")
        .set("Authorization", `Bearer ${uid}`)
        .send()
        .expect(200);

      //THEN
      expect(body.message).toEqual("Result retrieved");
      expect(body.data).toEqual({ ...result, _id: result._id });
    });
    it("should get last result with ape key", async () => {
      //GIVEN
      await acceptApeKeys(true);
      const apeKey = await mockAuthenticateWithApeKey(uid, await configuration);
      const result = givenDbResult(uid);
      getLastResultMock.mockResolvedValue(result);

      //WHEN
      await mockApp
        .get("/results/last")
        .set("Authorization", `ApeKey ${apeKey}`)
        .send()
        .expect(200);
    });
    it("should rate limit get last result with ape key", async () => {
      //GIVEN
      const result = givenDbResult(uid, {
        charStats: undefined,
        incorrectChars: 5,
        correctChars: 12,
      });
      getLastResultMock.mockResolvedValue(result);
      await acceptApeKeys(true);
      const apeKey = await mockAuthenticateWithApeKey(uid, await configuration);

      //WHEN
      await expect(
        mockApp.get("/results/last").set("Authorization", `ApeKey ${apeKey}`),
      ).toBeRateLimited({ max: 30, windowMs: 60 * 1000 }); //should use defaultApeRateLimit
    });
  });
  describe("updateTags", () => {
    const getResultMock = vi.spyOn(ResultDal, "getResult");
    const updateTagsMock = vi.spyOn(ResultDal, "updateTags");
    const getUserPartialMock = vi.spyOn(UserDal, "getPartialUser");
    const checkIfTagPbMock = vi.spyOn(UserDal, "checkIfTagPb");

    afterEach(() => {
      [
        getResultMock,
        updateTagsMock,
        getUserPartialMock,
        checkIfTagPbMock,
      ].forEach((it) => it.mockClear());
    });

    it("should update tags", async () => {
      //GIVEN
      const result = givenDbResult(uid);
      const resultIdString = result._id;
      const tagIds = [newId(), newId()];
      const partialUser = { tags: [] };
      getResultMock.mockResolvedValue(result);
      updateTagsMock.mockResolvedValue({} as any);
      getUserPartialMock.mockResolvedValue(partialUser as any);
      checkIfTagPbMock.mockResolvedValue([]);

      //WHEN
      const { body } = await mockApp
        .patch("/results/tags")
        .set("Authorization", `Bearer ${uid}`)
        .send({ resultId: resultIdString, tagIds })
        .expect(200);

      //THEN
      expect(body.message).toEqual("Result tags updated");
      expect(body.data).toEqual({
        tagPbs: [],
      });

      expect(updateTagsMock).toHaveBeenCalledWith(uid, resultIdString, tagIds);
      expect(getResultMock).toHaveBeenCalledWith(uid, resultIdString);
      expect(getUserPartialMock).toHaveBeenCalledWith(uid, "update tags", [
        "tags",
      ]);
      expect(checkIfTagPbMock).toHaveBeenCalledWith(uid, partialUser, result);
    });
    it("should apply defaults on missing data", async () => {
      //GIVEN
      const result = givenDbResult(uid);
      const partialResult = omit(result, [
        "difficulty",
        "language",
        "funbox",
        "lazyMode",
        "punctuation",
        "numbers",
      ]);

      const resultIdString = result._id;
      const tagIds = [newId(), newId()];
      const partialUser = { tags: [] };
      getResultMock.mockResolvedValue(partialResult);
      updateTagsMock.mockResolvedValue({} as any);
      getUserPartialMock.mockResolvedValue(partialUser as any);
      checkIfTagPbMock.mockResolvedValue([]);

      //WHEN
      const { body } = await mockApp
        .patch("/results/tags")
        .set("Authorization", `Bearer ${uid}`)
        .send({ resultId: resultIdString, tagIds })
        .expect(200);

      //THEN
      expect(body.message).toEqual("Result tags updated");
      expect(body.data).toEqual({
        tagPbs: [],
      });

      expect(updateTagsMock).toHaveBeenCalledWith(uid, resultIdString, tagIds);
      expect(getResultMock).toHaveBeenCalledWith(uid, resultIdString);
      expect(getUserPartialMock).toHaveBeenCalledWith(uid, "update tags", [
        "tags",
      ]);
      expect(checkIfTagPbMock).toHaveBeenCalledWith(uid, partialUser, {
        ...result,
        tags: tagIds,
        difficulty: "normal",
        language: "english",
        funbox: [],
        lazyMode: false,
        punctuation: false,
        numbers: false,
      });
    });
    it("should fail with missing mandatory properties", async () => {
      //GIVEN

      //WHEN
      const { body } = await mockApp
        .patch("/results/tags")
        .set("Authorization", `Bearer ${uid}`)
        .send({})
        .expect(422);

      //THEN
      expect(body).toEqual({
        message: "Invalid request data schema",
        validationErrors: ['"tagIds" Required', '"resultId" Required'],
      });
    });
    it("should fail with unknown properties", async () => {
      //GIVEN

      //WHEN
      const { body } = await mockApp
        .patch("/results/tags")
        .set("Authorization", `Bearer ${uid}`)
        .send({ extra: "value" })
        .expect(422);

      //THEN
      expect(body).toEqual({
        message: "Invalid request data schema",
        validationErrors: [
          '"tagIds" Required',
          '"resultId" Required',
          "Unrecognized key(s) in object: 'extra'",
        ],
      });
    });
  });
  describe("addResult", () => {
    const insertedId = newId();
    const userGetMock = vi.spyOn(UserDal, "getUser");
    const userUpdateStreakMock = vi.spyOn(UserDal, "updateStreak");
    const userCheckIfTagPbMock = vi.spyOn(UserDal, "checkIfTagPb");
    const userCheckIfPbMock = vi.spyOn(UserDal, "checkIfPb");
    vi.spyOn(UserDal, "incrementTestActivity").mockResolvedValue();
    vi.spyOn(UserDal, "incrementBananas").mockResolvedValue();
    const userIncrementXpMock = vi.spyOn(UserDal, "incrementXp");
    const userUpdateTypingStatsMock = vi.spyOn(UserDal, "updateTypingStats");
    const resultAddMock = vi.spyOn(ResultDal, "addResult");
    const resultGetLastTimestampMock = vi.spyOn(
      ResultDal,
      "getLastResultTimestamp",
    );
    const hasSubmissionHashMock = vi.spyOn(ResultDal, "hasSubmissionHash");
    const userUpdateLastTimingHashesMock = vi.spyOn(
      UserDal,
      "updateLastTimingHashes",
    );
    const userRecordAutoBanEventMock = vi.spyOn(UserDal, "recordAutoBanEvent");
    const userAddToInboxMock = vi.spyOn(UserDal, "addToInbox");
    const purgeDailyMock = vi.spyOn(
      DailyLeaderboards,
      "purgeUserFromDailyLeaderboards",
    );
    const purgeWeeklyMock = vi.spyOn(
      WeeklyXpLeaderboardModule,
      "purgeUserFromXpLeaderboards",
    );
    const publicUpdateStatsMock = vi.spyOn(PublicDal, "updateStats");
    const weeklyXpAddResultMock = vi.spyOn(
      WeeklyXpLeaderboard.prototype,
      "addResult",
    );
    const dailyAddResultMock = vi.spyOn(
      DailyLeaderboard.prototype,
      "addResult",
    );

    beforeEach(async () => {
      await enableResultsSaving(true);
      await enableUsersXpGain(true);
      await setResultsConfig({ objectHashCheckEnabled: false });
      await setAnticheatConfig(BASE_CONFIGURATION.anticheat);
      await setAutoBanConfig(BASE_CONFIGURATION.users.autoBan);

      [
        userGetMock,
        userUpdateStreakMock,
        userCheckIfTagPbMock,
        userCheckIfPbMock,
        userIncrementXpMock,
        userUpdateTypingStatsMock,
        resultAddMock,
        resultGetLastTimestampMock,
        hasSubmissionHashMock,
        userUpdateLastTimingHashesMock,
        userRecordAutoBanEventMock,
        userAddToInboxMock,
        purgeDailyMock,
        purgeWeeklyMock,
        publicUpdateStatsMock,
        weeklyXpAddResultMock,
        dailyAddResultMock,
      ].forEach((it) => it.mockClear());

      userGetMock.mockResolvedValue({ name: "bob" } as any);
      userUpdateStreakMock.mockResolvedValue(0);
      userCheckIfTagPbMock.mockResolvedValue([]);
      userCheckIfPbMock.mockResolvedValue(true);
      resultAddMock.mockResolvedValue({ insertedId });
      hasSubmissionHashMock.mockResolvedValue(false);
      userUpdateLastTimingHashesMock.mockResolvedValue();
      userRecordAutoBanEventMock.mockResolvedValue(false);
      userAddToInboxMock.mockResolvedValue();
      purgeDailyMock.mockResolvedValue();
      purgeWeeklyMock.mockResolvedValue();
      //a prior result exists so incomplete-test time is credited (not zeroed)
      resultGetLastTimestampMock.mockResolvedValue(0);
      userIncrementXpMock.mockResolvedValue();
      userUpdateTypingStatsMock.mockResolvedValue();
      weeklyXpAddResultMock.mockResolvedValue(1);
      dailyAddResultMock.mockResolvedValue(-1);
    });

    it("should add result", async () => {
      //GIVEN

      const completedEvent = buildCompletedEvent({
        funbox: ["58008", "read_ahead_hard"],
      });
      //WHEN
      const { body } = await mockApp
        .post("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send({
          result: completedEvent,
        })
        .expect(200);

      expect(body.message).toEqual("Result saved");
      expect(body.data).toEqual({
        isPb: true,
        tagPbs: [],
        xp: 177,
        dailyXpBonus: true,
        xpBreakdown: {
          accPenalty: 28,
          base: 20,
          incomplete: 5,
          funbox: 80,
          daily: 100,
        },
        streak: 0,
        insertedId: insertedId,
      });

      expect(resultAddMock).toHaveBeenCalledWith(
        uid,
        expect.objectContaining({
          acc: 86,
          afkDuration: 5,
          charStats: [100, 2, 3, 5],
          chartData: {
            err: [0, 2, 0],
            burst: [50, 55, 56],
            wpm: [1, 2, 3],
          },
          consistency: 95.11,
          incompleteTestSeconds: 10,
          isPb: true,
          keyConsistency: 8.9,
          keyDurationStats: {
            average: 3.75,
            sd: 2.59,
          },
          keySpacingStats: {
            average: 2,
            sd: 1.63,
          },
          mode: "time",
          mode2: "15",
          name: "bob",
          rawWpm: 99.34,
          restartCount: 4,
          tags: ["tagOneId", "tagTwoId"],
          testDuration: 15.1,
          uid: uid,
          wpm: 79.47,
        }),
      );

      expect(publicUpdateStatsMock).toHaveBeenCalledWith(
        4,
        15.1 + 10 - 5, //duration + incompleteTestSeconds-afk
        "web",
      );
      expect(userIncrementXpMock).toHaveBeenCalledWith(uid, 177, "web");
      expect(weeklyXpAddResultMock).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true }),
        expect.objectContaining({ xpGained: 177 }),
      );
      expect(userUpdateTypingStatsMock).toHaveBeenCalledWith(
        uid,
        4,
        15.1 + 10 - 5, //duration + incompleteTestSeconds-afk
        "web",
      );
    });
    it("should fail if result saving is disabled", async () => {
      //GIVEN
      await enableResultsSaving(false);

      //WHEN
      const { body } = await mockApp
        .post("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send({})
        .expect(503);

      //THEN
      expect(body.message).toEqual("Results are not being saved at this time.");
    });
    it("fails closed when result history cannot be read", async () => {
      resultGetLastTimestampMock.mockRejectedValue(new Error("D1 unavailable"));
      await mockApp
        .post("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send({ result: buildCompletedEvent() })
        .expect(500);
      expect(resultAddMock).not.toHaveBeenCalled();
      expect(userIncrementXpMock).not.toHaveBeenCalled();
    });
    it("treats only a missing history as the first result and clears abandoned-test credit", async () => {
      resultGetLastTimestampMock.mockRejectedValue(
        new MonkeyError(404, "No last result found"),
      );
      await mockApp
        .post("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send({ result: buildCompletedEvent() })
        .expect(200);
      expect(userUpdateTypingStatsMock).toHaveBeenCalledWith(
        uid,
        4,
        10.1,
        "web",
      );
    });
    it("adds english time 15 results to the daily leaderboard by default", async () => {
      await mockApp
        .post("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send({ result: buildCompletedEvent() })
        .expect(200);
      expect(dailyAddResultMock).toHaveBeenCalledWith(
        expect.objectContaining({ uid, wpm: 79.47 }),
        expect.objectContaining({ enabled: true }),
      );
    });
    it("keeps other modes off the daily leaderboard", async () => {
      await mockApp
        .post("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send({
          result: buildCompletedEvent({ mode: "words", mode2: "10" }),
        })
        .expect(200);
      expect(dailyAddResultMock).not.toHaveBeenCalled();
    });
    it("reads the last result timestamp while loading the user", async () => {
      let resolveUser: (user: any) => void = () => undefined;
      userGetMock.mockReturnValueOnce(
        new Promise((resolve) => (resolveUser = resolve)),
      );
      const request = mockApp
        .post("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send({ result: buildCompletedEvent() })
        .then((response) => response);
      await vi.waitFor(() =>
        expect(resultGetLastTimestampMock).toHaveBeenCalledWith(uid, "web"),
      );
      resolveUser({ name: "bob" });
      expect((await request).status).toBe(200);
    });
    it("looks up daily and weekly ranks together after saving", async () => {
      dailyAddResultMock.mockResolvedValue(3);
      let resolveDaily: (entry: any) => void = () => undefined;
      const dailyRank = vi
        .spyOn(DailyLeaderboard.prototype, "getRank")
        .mockReturnValue(new Promise((resolve) => (resolveDaily = resolve)));
      const weeklyRank = vi
        .spyOn(WeeklyXpLeaderboard.prototype, "getRank")
        .mockResolvedValue({ rank: 7 } as any);

      try {
        const request = mockApp
          .post("/results")
          .set("Authorization", `Bearer ${uid}`)
          .send({ result: buildCompletedEvent({ language: "english" }) })
          .then((response) => response);
        await vi.waitFor(() => expect(dailyRank).toHaveBeenCalled());
        expect(weeklyRank).toHaveBeenCalled();
        resolveDaily({ rank: 2 });

        const { body } = await request;
        expect(body.data).toMatchObject({
          dailyLeaderboardRank: 2,
          weeklyXpLeaderboardRank: 7,
        });
      } finally {
        dailyRank.mockRestore();
        weeklyRank.mockRestore();
      }
    });
    it("should fail without mandatory properties", async () => {
      //GIVEN

      //WHEN
      const { body } = await mockApp
        .post("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send({})
        .expect(422);

      //THEN
      expect(body).toEqual({
        message: "Invalid request data schema",
        validationErrors: ['"result" Required'],
      });
    });
    it("should fail with unknown properties", async () => {
      //GIVEN

      //WHEN
      const { body } = await mockApp
        .post("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send({
          result: buildCompletedEvent({
            extra2: "value",
          } as any),
          extra: "value",
        })
        .expect(422);

      //THEN
      expect(body).toEqual({
        message: "Invalid request data schema",
        validationErrors: [
          `"result" Unrecognized key(s) in object: 'extra2'`,
          "Unrecognized key(s) in object: 'extra'",
        ],
      });
    });

    it("should fail wit duplicate funboxes", async () => {
      //GIVEN

      //WHEN
      const { body } = await mockApp
        .post("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send({
          result: buildCompletedEvent({
            funbox: ["58008", "58008"],
          }),
        })
        .expect(400);

      //THEN
      expect(body.message).toEqual("Duplicate funboxes");
    });

    it("should fail with invalid properties", async () => {
      //WHEN
      const { body } = await mockApp
        .post("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send({
          result: buildCompletedEvent({
            acc: 101,
            wpm: -1,
            mode: "invalid" as any,
            difficulty: "insane" as any,
            charStats: [1, 2] as any,
          }),
        })
        .expect(422);

      //THEN
      expect(body).toEqual({
        message: "Invalid request data schema",
        validationErrors: [
          '"result.wpm" Number must be greater than or equal to 0',
          '"result.charStats" Array must contain at least 4 element(s)',
          '"result.acc" Number must be less than or equal to 100',
          `"result.mode" Invalid enum value. Expected 'time' | 'words' | 'quote' | 'custom' | 'zen', received 'invalid'`,
          `"result.difficulty" Invalid enum value. Expected 'normal' | 'expert' | 'master', received 'insane'`,
        ],
      });
      expect(resultAddMock).not.toHaveBeenCalled();
    });
    it("should fail if user needs to change name", async () => {
      //GIVEN
      userGetMock.mockResolvedValue({
        name: "bob",
        needsToChangeName: true,
      } as any);

      //WHEN
      const { body } = await mockApp
        .post("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send({ result: buildCompletedEvent() })
        .expect(403);

      //THEN
      expect(body.message).toEqual(
        "Please change your name before submitting a result",
      );
      expect(resultAddMock).not.toHaveBeenCalled();
    });
    it("should fail if test is too short", async () => {
      //WHEN
      const { body } = await mockApp
        .post("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send({ result: buildCompletedEvent({ mode2: "10" }) })
        .expect(460);

      //THEN
      expect(body.message).toEqual("Test too short");
      expect(resultAddMock).not.toHaveBeenCalled();
    });
    it("should fail with too low accuracy", async () => {
      //WHEN
      const { body } = await mockApp
        .post("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send({ result: buildCompletedEvent({ acc: 74 }) })
        .expect(400);

      //THEN
      expect(body.message).toEqual("Accuracy too low");
      expect(resultAddMock).not.toHaveBeenCalled();
    });
    it("should fail with impossible funbox combination", async () => {
      //WHEN
      const { body } = await mockApp
        .post("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send({
          result: buildCompletedEvent({ funbox: ["plus_one", "plus_two"] }),
        })
        .expect(400);

      //THEN
      expect(body.message).toEqual("Impossible funbox combination");
      expect(resultAddMock).not.toHaveBeenCalled();
    });
    it("should fail with offline results older than 30 days", async () => {
      //WHEN
      const { body } = await mockApp
        .post("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send({
          result: buildCompletedEvent({
            offline: true,
            timestamp: Date.now() - 31 * 86400000,
          }),
        })
        .expect(400);

      //THEN
      expect(body.message).toEqual(
        "Offline results must be within the last 30 days",
      );
      expect(resultAddMock).not.toHaveBeenCalled();
    });
    it("should fail with incorrect result hash", async () => {
      //GIVEN
      await setResultsConfig({ objectHashCheckEnabled: true });

      //WHEN
      const { body } = await mockApp
        .post("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send({ result: buildCompletedEvent({ hash: "wrong" }) })
        .expect(461);

      //THEN
      expect(body.message).toEqual("Incorrect result hash");
      expect(addLogMock).toHaveBeenCalledWith(
        "incorrect_result_hash",
        expect.objectContaining({ resulthash: "wrong" }),
        uid,
      );
      expect(resultAddMock).not.toHaveBeenCalled();
    });
    it("should accept a valid result hash", async () => {
      //GIVEN
      await setResultsConfig({ objectHashCheckEnabled: true });
      const { hash: _hash, ...result } = buildCompletedEvent();

      //WHEN
      await mockApp
        .post("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send({ result: { ...result, hash: objectHash(result) } })
        .expect(200);

      //THEN
      expect(resultAddMock).toHaveBeenCalled();
    });
    it("should fail with duplicate submission", async () => {
      //GIVEN
      hasSubmissionHashMock.mockResolvedValue(true);

      //WHEN
      const { body } = await mockApp
        .post("/results")
        .set("Authorization", `Bearer ${uid}`)
        .send({ result: buildCompletedEvent() })
        .expect(466);

      //THEN
      expect(body.message).toEqual("Duplicate result");
      expect(resultAddMock).not.toHaveBeenCalled();
      expect(userIncrementXpMock).not.toHaveBeenCalled();
    });

    describe("anticheat", () => {
      const fixedTimings = (): Partial<CompletedEvent> => {
        const keySpacing = Array.from({ length: 219 }, () => 120);
        return {
          keySpacing,
          keyDuration: Array.from({ length: 220 }, () => 50),
          keyConsistency: consistency(keySpacing.slice(0, -1)),
          lastKeyToEnd: 30_000 - 219 * 120,
        };
      };
      const expectNoProgress = (): void => {
        expect(resultAddMock).not.toHaveBeenCalled();
        expect(userCheckIfPbMock).not.toHaveBeenCalled();
        expect(userIncrementXpMock).not.toHaveBeenCalled();
        expect(userUpdateTypingStatsMock).not.toHaveBeenCalled();
        expect(weeklyXpAddResultMock).not.toHaveBeenCalled();
        expect(dailyAddResultMock).not.toHaveBeenCalled();
      };
      const expectRejected = (reason: string): void => {
        expect(addImportantLogMock).toHaveBeenCalledWith(
          "anticheat_rejected",
          expect.objectContaining({ reason }),
          uid,
        );
      };

      it("should reject inconsistent scores", async () => {
        //WHEN
        const { body } = await mockApp
          .post("/results")
          .set("Authorization", `Bearer ${uid}`)
          .send({ result: buildCompletedEvent({ wpm: 200 }) })
          .expect(463);

        //THEN
        expect(body.message).toEqual("Result data doesn't make sense");
        expect(addImportantLogMock).toHaveBeenCalledWith(
          "anticheat_rejected",
          expect.objectContaining({
            reason: expect.any(String),
            mode: "time",
            mode2: "15",
          }),
          uid,
        );
        expectNoProgress();
      });
      it("should reject inconsistent key data", async () => {
        //WHEN
        const { body } = await mockApp
          .post("/results")
          .set("Authorization", `Bearer ${uid}`)
          .send({ result: buildCompletedEvent({ keyDuration: [1, 2] }) })
          .expect(463);

        //THEN
        expect(body.message).toEqual("Result data doesn't make sense");
        expectRejected("key-count-mismatch");
        expectNoProgress();
      });
      it("should reject invalid result spacing", async () => {
        //GIVEN
        resultGetLastTimestampMock.mockResolvedValue(Date.now());

        //WHEN
        const { body } = await mockApp
          .post("/results")
          .set("Authorization", `Bearer ${uid}`)
          .send({ result: buildCompletedEvent() })
          .expect(462);

        //THEN
        expect(body.message).toEqual("Invalid result spacing");
        expect(addLogMock).toHaveBeenCalledWith(
          "invalid_result_spacing",
          expect.any(Object),
          uid,
        );
        expectNoProgress();
      });

      describe("bot check", () => {
        beforeEach(async () => {
          //80 wpm results enter the bot check
          await setAnticheatConfig({ botCheckMinWpm: 50 });
        });

        it("should reject missing key data", async () => {
          //WHEN
          const { body } = await mockApp
            .post("/results")
            .set("Authorization", `Bearer ${uid}`)
            .send({
              result: typedEvent({
                keySpacing: [],
                keyDuration: [],
                keyConsistency: 0,
              }),
            })
            .expect(464);

          //THEN
          expect(body.message).toEqual("Missing key data");
          expectRejected("missing-key-data");
          expectNoProgress();
        });
        it("should reject fixed key timings", async () => {
          //WHEN
          const { body } = await mockApp
            .post("/results")
            .set("Authorization", `Bearer ${uid}`)
            .send({ result: typedEvent(fixedTimings()) })
            .expect(465);

          //THEN
          expect(body.message).toEqual("Possible bot detected");
          expectRejected("uniform-key-timing");
          expect(userRecordAutoBanEventMock).not.toHaveBeenCalled();
          expectNoProgress();
        });
        it("should record a strike without banning", async () => {
          //GIVEN
          await setAutoBanConfig({ enabled: true, maxCount: 5, maxHours: 1 });

          //WHEN
          await mockApp
            .post("/results")
            .set("Authorization", `Bearer ${uid}`)
            .send({ result: typedEvent(fixedTimings()) })
            .expect(465);

          //THEN
          expect(userRecordAutoBanEventMock).toHaveBeenCalledWith(uid, 5, 1);
          expect(userAddToInboxMock).not.toHaveBeenCalled();
          expect(purgeDailyMock).not.toHaveBeenCalled();
          expect(purgeWeeklyMock).not.toHaveBeenCalled();
        });
        it("should auto ban after too many strikes", async () => {
          //GIVEN
          await setAutoBanConfig({ enabled: true, maxCount: 5, maxHours: 1 });
          userRecordAutoBanEventMock.mockResolvedValue(true);

          //WHEN
          await mockApp
            .post("/results")
            .set("Authorization", `Bearer ${uid}`)
            .send({ result: typedEvent(fixedTimings()) })
            .expect(465);

          //THEN
          expect(userAddToInboxMock).toHaveBeenCalledWith(
            uid,
            [expect.objectContaining({ subject: "Banned" })],
            expect.anything(),
          );
          expect(purgeDailyMock).toHaveBeenCalledWith(uid, expect.anything());
          expect(purgeWeeklyMock).toHaveBeenCalledWith(uid, expect.anything());
          expectNoProgress();
        });
        it("should save varied key timings", async () => {
          //WHEN
          await mockApp
            .post("/results")
            .set("Authorization", `Bearer ${uid}`)
            .send({ result: typedEvent() })
            .expect(200);

          //THEN
          expect(resultAddMock).toHaveBeenCalled();
        });
        it.for([
          { name: "verified", user: { verified: true } },
          { name: "leaderboard opt out", user: { lbOptOut: true } },
        ])("should exempt $name users", async ({ user }) => {
          //GIVEN
          userGetMock.mockResolvedValue({ name: "bob", ...user } as any);

          //WHEN
          await mockApp
            .post("/results")
            .set("Authorization", `Bearer ${uid}`)
            .send({ result: typedEvent(fixedTimings()) })
            .expect(200);

          //THEN
          expect(resultAddMock).toHaveBeenCalled();
        });
        it("should skip results below the minimum wpm", async () => {
          //GIVEN
          await setAnticheatConfig({ botCheckMinWpm: 130 });

          //WHEN
          await mockApp
            .post("/results")
            .set("Authorization", `Bearer ${uid}`)
            .send({ result: typedEvent(fixedTimings()) })
            .expect(200);

          //THEN
          expect(resultAddMock).toHaveBeenCalled();
        });
      });

      describe("replay check", () => {
        it("should reject replayed key timings", async () => {
          //GIVEN
          const result = typedEvent();
          userGetMock.mockResolvedValue({
            name: "bob",
            lastTimingHashes: [getTimingFingerprint(result)],
          } as any);

          //WHEN
          const { body } = await mockApp
            .post("/results")
            .set("Authorization", `Bearer ${uid}`)
            .send({ result: { ...result, timestamp: 2000, punctuation: true } })
            .expect(466);

          //THEN
          expect(body.message).toEqual("Duplicate result");
          expectRejected("replayed-key-timing");
          expect(userRecordAutoBanEventMock).not.toHaveBeenCalled();
          expect(userUpdateLastTimingHashesMock).not.toHaveBeenCalled();
          expectNoProgress();
        });
        it("should store new fingerprints", async () => {
          //GIVEN
          await setAnticheatConfig({
            replayCheck: { enabled: true, maxFingerprints: 2 },
          });
          const result = typedEvent();
          userGetMock.mockResolvedValue({
            name: "bob",
            lastTimingHashes: ["a", "b"],
          } as any);

          //WHEN
          await mockApp
            .post("/results")
            .set("Authorization", `Bearer ${uid}`)
            .send({ result })
            .expect(200);

          //THEN
          expect(userUpdateLastTimingHashesMock).toHaveBeenCalledWith(uid, [
            getTimingFingerprint(result),
            "a",
          ]);
        });
        it("should not check when disabled", async () => {
          //GIVEN
          await setAnticheatConfig({
            replayCheck: { enabled: false, maxFingerprints: 50 },
          });
          const result = typedEvent();
          userGetMock.mockResolvedValue({
            name: "bob",
            lastTimingHashes: [getTimingFingerprint(result)],
          } as any);

          //WHEN
          await mockApp
            .post("/results")
            .set("Authorization", `Bearer ${uid}`)
            .send({ result })
            .expect(200);

          //THEN
          expect(userUpdateLastTimingHashesMock).not.toHaveBeenCalled();
        });
      });
    });
  });
});

function buildCompletedEvent(result?: Partial<CompletedEvent>): CompletedEvent {
  return {
    client: "web",
    acc: 86,
    afkDuration: 5,
    bailedOut: false,
    blindMode: false,
    charStats: [100, 2, 3, 5],
    chartData: { wpm: [1, 2, 3], burst: [50, 55, 56], err: [0, 2, 0] },
    consistency: 95.11,
    difficulty: "normal",
    funbox: [],
    hash: "hash",
    incompleteTestSeconds: 10,
    incompleteTests: [2, 2, 2, 4].map((seconds) => ({ acc: 75, seconds })),
    keyConsistency: 8.9,
    keyDuration: [0, 3, 5, 7],
    keySpacing: [0, 2, 4],
    language: "english",
    lazyMode: false,
    mode: "time",
    mode2: "15",
    numbers: false,
    punctuation: false,
    rawWpm: 99.34,
    restartCount: 4,
    tags: ["tagOneId", "tagTwoId"],
    testDuration: 15.1,
    timestamp: 1000,
    uid,
    wpmConsistency: 59.2,
    wpm: 79.47,
    stopOnLetter: false,
    //new required
    charTotal: 125,
    keyOverlap: 7,
    lastKeyToEnd: 15083,
    startToFirstKey: 11,
    ...result,
  };
}

async function enablePremiumFeatures(enabled: boolean): Promise<void> {
  const mockConfig = await configuration;
  mockConfig.users.premium = { ...mockConfig.users.premium, enabled };

  vi.spyOn(Configuration, "getCachedConfiguration").mockResolvedValue(
    mockConfig,
  );
}
function givenDbResult(uid: string, customize?: Partial<DBResult>): DBResult {
  return {
    _id: newId(),
    wpm: Math.random() * 100,
    rawWpm: Math.random() * 100,
    charStats: [
      Math.round(Math.random() * 10),
      Math.round(Math.random() * 10),
      Math.round(Math.random() * 10),
      Math.round(Math.random() * 10),
    ],
    acc: 80 + Math.random() * 20, //min accuracy is 75%
    mode: "time",
    mode2: "60",
    timestamp: Math.round(Math.random() * 100),
    testDuration: 1 + Math.random() * 100,
    consistency: Math.random() * 100,
    keyConsistency: Math.random() * 100,
    uid,
    keySpacingStats: { average: Math.random() * 100, sd: Math.random() },
    keyDurationStats: { average: Math.random() * 100, sd: Math.random() },
    isPb: true,
    chartData: {
      wpm: [Math.random() * 100],
      burst: [Math.random() * 100],
      err: [Math.random() * 100],
    },
    name: "testName",
    ...customize,
  };
}

async function acceptApeKeys(enabled: boolean): Promise<void> {
  const mockConfig = await configuration;
  mockConfig.apeKeys = {
    ...mockConfig.apeKeys,
    acceptKeys: enabled,
  };

  vi.spyOn(Configuration, "getCachedConfiguration").mockResolvedValue(
    mockConfig,
  );
}

async function enableResultsSaving(enabled: boolean): Promise<void> {
  const mockConfig = await configuration;
  mockConfig.results = { ...mockConfig.results, savingEnabled: enabled };

  vi.spyOn(Configuration, "getCachedConfiguration").mockResolvedValue(
    mockConfig,
  );
}
async function enableUsersXpGain(enabled: boolean): Promise<void> {
  const mockConfig = await configuration;
  mockConfig.users.xp = { ...mockConfig.users.xp, enabled, funboxBonus: 1 };

  vi.spyOn(Configuration, "getCachedConfiguration").mockResolvedValue(
    mockConfig,
  );
}
async function setResultsConfig(
  results: Partial<Awaited<typeof configuration>["results"]>,
): Promise<void> {
  const mockConfig = await configuration;
  mockConfig.results = { ...mockConfig.results, ...results };

  vi.spyOn(Configuration, "getCachedConfiguration").mockResolvedValue(
    mockConfig,
  );
}
async function setAnticheatConfig(
  anticheat: Partial<Awaited<typeof configuration>["anticheat"]>,
): Promise<void> {
  const mockConfig = await configuration;
  mockConfig.anticheat = { ...mockConfig.anticheat, ...anticheat };

  vi.spyOn(Configuration, "getCachedConfiguration").mockResolvedValue(
    mockConfig,
  );
}
async function setAutoBanConfig(
  autoBan: Awaited<typeof configuration>["users"]["autoBan"],
): Promise<void> {
  const mockConfig = await configuration;
  mockConfig.users = { ...mockConfig.users, autoBan };

  vi.spyOn(Configuration, "getCachedConfiguration").mockResolvedValue(
    mockConfig,
  );
}
