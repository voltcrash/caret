import { describe, it, expect, beforeEach, vi } from "vite-plus/test";
import { setup } from "../../__testData__/controller-test";
import { newId } from "../../../src/utils/id";
import * as Configuration from "../../../src/init/configuration";
import * as AdminUuidDal from "../../../src/dal/admin-uids";
import * as UserDal from "../../../src/dal/user";
import * as ReportDal from "../../../src/dal/report";
import * as LogsDal from "../../../src/dal/logs";
import * as DailyLeaderboards from "../../../src/utils/daily-leaderboards";
import * as WeeklyXpLeaderboard from "../../../src/services/weekly-xp-leaderboard";
import * as UserDeletion from "../../../src/services/user-deletion";

import { enableRateLimitExpects } from "../../__testData__/rate-limit";
import type { TestRequest } from "../../__testData__/test-client";

const { mockApp, uid } = setup();
const configuration = Configuration.getCachedConfiguration();
enableRateLimitExpects();

describe("AdminController", () => {
  const isAdminMock = vi.spyOn(AdminUuidDal, "isAdmin");
  const logsAddImportantLog = vi.spyOn(LogsDal, "addImportantLog");

  beforeEach(async () => {
    isAdminMock.mockClear();
    await enableAdminEndpoints(true);
    isAdminMock.mockResolvedValue(true);
    logsAddImportantLog.mockClear().mockResolvedValue();
  });

  describe("check for admin", () => {
    it("should succeed if user is admin", async () => {
      //GIVEN

      //WHEN
      const { body } = await mockApp
        .get("/admin")
        .set("Authorization", `Bearer ${uid}`)
        .expect(200);

      //THEN
      expect(body).toEqual({
        message: "OK",
        data: null,
      });

      expect(isAdminMock).toHaveBeenCalledWith(uid);
    });
    it("should fail if user is no admin", async () => {
      await expectFailForNonAdmin(
        mockApp.get("/admin").set("Authorization", `Bearer ${uid}`),
      );
    });
    it("should fail if admin endpoints are disabled", async () => {
      await expectFailForDisabledEndpoint(
        mockApp.get("/admin").set("Authorization", `Bearer ${uid}`),
      );
    });
    it("should be rate limited", async () => {
      await expect(
        mockApp.get("/admin").set("Authorization", `Bearer ${uid}`),
      ).toBeRateLimited({ max: 1, windowMs: 5000 });
    });
  });

  describe("toggle ban", () => {
    const userBannedMock = vi.spyOn(UserDal, "setBanned");
    const getUserMock = vi.spyOn(UserDal, "getPartialUser");
    const purgeUserFromDailyLeaderboardsMock = vi.spyOn(
      DailyLeaderboards,
      "purgeUserFromDailyLeaderboards",
    );
    const purgeUserFromXpLeaderboardsMock = vi.spyOn(
      WeeklyXpLeaderboard,
      "purgeUserFromXpLeaderboards",
    );

    beforeEach(() => {
      [
        userBannedMock,
        getUserMock,
        purgeUserFromDailyLeaderboardsMock,
        purgeUserFromXpLeaderboardsMock,
      ].forEach((it) => it.mockClear());
      userBannedMock.mockResolvedValue();
      purgeUserFromDailyLeaderboardsMock.mockResolvedValue();
      purgeUserFromXpLeaderboardsMock.mockResolvedValue();
    });

    it("should ban user", async () => {
      //GIVEN
      const victimUid = newId();
      getUserMock.mockResolvedValue({
        banned: false,
      } as any);

      //WHEN
      const { body } = await mockApp
        .post("/admin/toggleBan")
        .send({ uid: victimUid })
        .set("Authorization", `Bearer ${uid}`)
        .expect(200);

      //THEN
      expect(body).toEqual({
        message: "Ban toggled",
        data: { banned: true },
      });

      expect(getUserMock).toHaveBeenCalledWith(victimUid, "toggle ban", [
        "banned",
      ]);
      expect(userBannedMock).toHaveBeenCalledWith(victimUid, true);
      expect(purgeUserFromDailyLeaderboardsMock).toHaveBeenCalledWith(
        victimUid,
        (await configuration).dailyLeaderboards,
      );
      expect(purgeUserFromXpLeaderboardsMock).toHaveBeenCalledWith(
        victimUid,
        (await configuration).leaderboards.weeklyXp,
      );
    });
    it("should unban user", async () => {
      //GIVEN
      const victimUid = newId();
      getUserMock.mockResolvedValue({
        banned: true,
      } as any);

      //WHEN
      const { body } = await mockApp
        .post("/admin/toggleBan")
        .send({ uid: victimUid })
        .set("Authorization", `Bearer ${uid}`)
        .expect(200);

      //THEN
      expect(body).toEqual({
        message: "Ban toggled",
        data: { banned: false },
      });

      expect(getUserMock).toHaveBeenCalledWith(victimUid, "toggle ban", [
        "banned",
      ]);
      expect(userBannedMock).toHaveBeenCalledWith(victimUid, false);
      expect(purgeUserFromDailyLeaderboardsMock).not.toHaveBeenCalled();
      expect(purgeUserFromXpLeaderboardsMock).not.toHaveBeenCalled();
    });
    it("should fail without mandatory properties", async () => {
      //GIVEN

      //WHEN
      const { body } = await mockApp
        .post("/admin/toggleBan")
        .send({})
        .set("Authorization", `Bearer ${uid}`)
        .expect(422);

      //THEN
      expect(body).toEqual({
        message: "Invalid request data schema",
        validationErrors: ['"uid" Required'],
      });
    });
    it("should fail with unknown properties", async () => {
      //GIVEN

      //WHEN
      const { body } = await mockApp
        .post("/admin/toggleBan")
        .send({ uid: newId(), extra: "value" })
        .set("Authorization", `Bearer ${uid}`)
        .expect(422);

      //THEN
      expect(body).toEqual({
        message: "Invalid request data schema",
        validationErrors: ["Unrecognized key(s) in object: 'extra'"],
      });
    });
    it("should fail if user is no admin", async () => {
      await expectFailForNonAdmin(
        mockApp
          .post("/admin/toggleBan")
          .send({ uid: newId() })
          .set("Authorization", `Bearer ${uid}`),
      );
    });
    it("should fail if admin endpoints are disabled", async () => {
      //GIVEN
      await expectFailForDisabledEndpoint(
        mockApp
          .post("/admin/toggleBan")
          .send({ uid: newId() })
          .set("Authorization", `Bearer ${uid}`),
      );
    });
    it("should be rate limited", async () => {
      //GIVEN
      const victimUid = newId();
      getUserMock.mockResolvedValue({
        banned: false,
      } as any);

      //WHEN
      await expect(
        mockApp
          .post("/admin/toggleBan")
          .send({ uid: victimUid })
          .set("Authorization", `Bearer ${uid}`),
      ).toBeRateLimited({ max: 1, windowMs: 5000 });
    });
  });

  describe("clear streak hour offset", () => {
    const clearStreakHourOffset = vi.spyOn(UserDal, "clearStreakHourOffset");

    beforeEach(() => {
      clearStreakHourOffset.mockClear();
      clearStreakHourOffset.mockResolvedValue();
    });

    it("should clear streak hour offset for user", async () => {
      //GIVEN
      const victimUid = newId();

      //WHEN
      const { body } = await mockApp
        .post("/admin/clearStreakHourOffset")
        .send({ uid: victimUid })
        .set("Authorization", `Bearer ${uid}`)
        .expect(200);

      //THEN
      expect(body).toEqual({
        message: "Streak hour offset cleared",
        data: null,
      });
      expect(clearStreakHourOffset).toHaveBeenCalledWith(victimUid);
    });
    it("should fail without mandatory properties", async () => {
      //GIVEN

      //WHEN
      const { body } = await mockApp
        .post("/admin/clearStreakHourOffset")
        .send({})
        .set("Authorization", `Bearer ${uid}`)
        .expect(422);

      //THEN
      expect(body).toEqual({
        message: "Invalid request data schema",
        validationErrors: ['"uid" Required'],
      });
    });
    it("should fail with unknown properties", async () => {
      //GIVEN

      //WHEN
      const { body } = await mockApp
        .post("/admin/clearStreakHourOffset")
        .send({ uid: newId(), extra: "value" })
        .set("Authorization", `Bearer ${uid}`)
        .expect(422);

      //THEN
      expect(body).toEqual({
        message: "Invalid request data schema",
        validationErrors: ["Unrecognized key(s) in object: 'extra'"],
      });
    });
    it("should fail if user is no admin", async () => {
      await expectFailForNonAdmin(
        mockApp
          .post("/admin/clearStreakHourOffset")
          .send({ uid: newId() })
          .set("Authorization", `Bearer ${uid}`),
      );
    });
    it("should fail if admin endpoints are disabled", async () => {
      //GIVEN
      await expectFailForDisabledEndpoint(
        mockApp
          .post("/admin/clearStreakHourOffset")
          .send({ uid: newId() })
          .set("Authorization", `Bearer ${uid}`),
      );
    });
    it("should be rate limited", async () => {
      //GIVEN
      const victimUid = newId();

      //WHEN
      await expect(
        mockApp
          .post("/admin/clearStreakHourOffset")
          .send({ uid: victimUid })
          .set("Authorization", `Bearer ${uid}`),
      ).toBeRateLimited({ max: 1, windowMs: 5000 });
    });
  });

  describe("accept reports", () => {
    const getReportsMock = vi.spyOn(ReportDal, "getReports");
    const deleteReportsMock = vi.spyOn(ReportDal, "deleteReports");

    beforeEach(() => {
      [getReportsMock, deleteReportsMock].forEach((it) => it.mockClear());
      deleteReportsMock.mockResolvedValue();
    });

    it("should accept reports", async () => {
      //GIVEN
      const reportOne = {
        id: "1",
        reason: "one",
      } as any as ReportDal.DBReport;
      const reportTwo = {
        id: "2",
        reason: "two",
      } as any as ReportDal.DBReport;
      getReportsMock.mockResolvedValue([reportOne, reportTwo]);

      //WHEN
      const { body } = await mockApp
        .post("/admin/report/accept")
        .send({
          reports: [{ reportId: reportOne.id }, { reportId: reportTwo.id }],
        })
        .set("Authorization", `Bearer ${uid}`)
        .expect(200);

      expect(body).toEqual({
        message: "Reports removed.",
        data: null,
      });

      expect(deleteReportsMock).toHaveBeenCalledWith(["1", "2"]);
    });
    it("should fail wihtout mandatory properties", async () => {
      //WHEN
      const { body } = await mockApp
        .post("/admin/report/accept")
        .send({})
        .set("Authorization", `Bearer ${uid}`)
        .expect(422);

      expect(body).toEqual({
        message: "Invalid request data schema",
        validationErrors: ['"reports" Required'],
      });
    });
    it("should fail with empty reports", async () => {
      //WHEN
      const { body } = await mockApp
        .post("/admin/report/accept")
        .send({ reports: [] })
        .set("Authorization", `Bearer ${uid}`)
        .expect(422);

      expect(body).toEqual({
        message: "Invalid request data schema",
        validationErrors: [
          '"reports" Array must contain at least 1 element(s)',
        ],
      });
    });
    it("should fail with unknown properties", async () => {
      //WHEN
      const { body } = await mockApp
        .post("/admin/report/accept")
        .send({ reports: [{ reportId: "1", extra2: "value" }], extra: "value" })
        .set("Authorization", `Bearer ${uid}`)
        .expect(422);

      expect(body).toEqual({
        message: "Invalid request data schema",
        validationErrors: [
          `"reports.0" Unrecognized key(s) in object: 'extra2'`,
          "Unrecognized key(s) in object: 'extra'",
        ],
      });
    });
    it("should fail if user is no admin", async () => {
      await expectFailForNonAdmin(
        mockApp
          .post("/admin/report/accept")
          .send({ reports: [] })
          .set("Authorization", `Bearer ${uid}`),
      );
    });
    it("should fail if admin endpoints are disabled", async () => {
      //GIVEN
      await expectFailForDisabledEndpoint(
        mockApp
          .post("/admin/report/accept")
          .send({ reports: [] })
          .set("Authorization", `Bearer ${uid}`),
      );
    });
    it("should be rate limited", async () => {
      //GIVEN
      getReportsMock.mockResolvedValue([{ id: "1", reason: "one" } as any]);

      //WHEN
      await expect(
        mockApp
          .post("/admin/report/accept")
          .send({ reports: [{ reportId: "1" }] })
          .set("Authorization", `Bearer ${uid}`),
      ).toBeRateLimited({ max: 1, windowMs: 5000 });
    });
  });
  describe("reject reports", () => {
    const getReportsMock = vi.spyOn(ReportDal, "getReports");
    const deleteReportsMock = vi.spyOn(ReportDal, "deleteReports");

    beforeEach(() => {
      [getReportsMock, deleteReportsMock].forEach((it) => {
        it.mockClear();
        deleteReportsMock.mockResolvedValue();
      });
    });

    it("should reject reports", async () => {
      //GIVEN
      const reportOne = {
        id: "1",
        reason: "one",
      } as any as ReportDal.DBReport;
      const reportTwo = {
        id: "2",
        reason: "two",
      } as any as ReportDal.DBReport;
      getReportsMock.mockResolvedValue([reportOne, reportTwo]);

      //WHEN
      const { body } = await mockApp
        .post("/admin/report/reject")
        .send({
          reports: [
            { reportId: reportOne.id, reason: "test" },
            { reportId: reportTwo.id },
          ],
        })
        .set("Authorization", `Bearer ${uid}`)
        .expect(200);

      expect(body).toEqual({
        message: "Reports removed.",
        data: null,
      });

      expect(deleteReportsMock).toHaveBeenCalledWith(["1", "2"]);
    });
    it("should fail wihtout mandatory properties", async () => {
      //WHEN
      const { body } = await mockApp
        .post("/admin/report/reject")
        .send({})
        .set("Authorization", `Bearer ${uid}`)
        .expect(422);

      expect(body).toEqual({
        message: "Invalid request data schema",
        validationErrors: ['"reports" Required'],
      });
    });
    it("should fail with empty reports", async () => {
      //WHEN
      const { body } = await mockApp
        .post("/admin/report/reject")
        .send({ reports: [] })
        .set("Authorization", `Bearer ${uid}`)
        .expect(422);

      expect(body).toEqual({
        message: "Invalid request data schema",
        validationErrors: [
          '"reports" Array must contain at least 1 element(s)',
        ],
      });
    });
    it("should fail with unknown properties", async () => {
      //WHEN
      const { body } = await mockApp
        .post("/admin/report/reject")
        .send({ reports: [{ reportId: "1", extra2: "value" }], extra: "value" })
        .set("Authorization", `Bearer ${uid}`)
        .expect(422);

      expect(body).toEqual({
        message: "Invalid request data schema",
        validationErrors: [
          `"reports.0" Unrecognized key(s) in object: 'extra2'`,
          "Unrecognized key(s) in object: 'extra'",
        ],
      });
    });
    it("should fail if user is no admin", async () => {
      await expectFailForNonAdmin(
        mockApp
          .post("/admin/report/reject")
          .send({ reports: [] })
          .set("Authorization", `Bearer ${uid}`),
      );
    });
    it("should fail if admin endpoints are disabled", async () => {
      //GIVEN
      await expectFailForDisabledEndpoint(
        mockApp
          .post("/admin/report/reject")
          .send({ reports: [] })
          .set("Authorization", `Bearer ${uid}`),
      );
    });
    it("should be rate limited", async () => {
      //GIVEN
      getReportsMock.mockResolvedValue([{ id: "1", reason: "one" } as any]);

      //WHEN
      await expect(
        mockApp
          .post("/admin/report/reject")
          .send({ reports: [{ reportId: "1" }] })
          .set("Authorization", `Bearer ${uid}`),
      ).toBeRateLimited({ max: 1, windowMs: 5000 });
    });
  });
  describe("delete user", () => {
    const deleteUserAccountMock = vi.spyOn(UserDeletion, "deleteUserAccount");

    beforeEach(() => {
      deleteUserAccountMock.mockClear().mockResolvedValue(undefined);
    });

    it("should delete user", async () => {
      //GIVEN
      const victimUid = newId();
      deleteUserAccountMock.mockResolvedValue({
        banned: false,
        name: "victim",
        email: "victim@example.com",
      });

      //WHEN
      const { body } = await mockApp
        .post("/admin/deleteUser")
        .send({ uid: victimUid })
        .set("Authorization", `Bearer ${uid}`)
        .expect(200);

      //THEN
      expect(body).toEqual({
        message: "User deleted",
        data: null,
      });

      expect(deleteUserAccountMock).toHaveBeenCalledWith(
        victimUid,
        expect.anything(),
      );
      expect(logsAddImportantLog).toHaveBeenCalledWith(
        "user_deleted_by_admin",
        "victim@example.com victim",
        victimUid,
      );
    });
    it("should fail for own account", async () => {
      //WHEN
      const { body } = await mockApp
        .post("/admin/deleteUser")
        .send({ uid })
        .set("Authorization", `Bearer ${uid}`)
        .expect(403);

      //THEN
      expect(body.message).toEqual(
        "You cannot delete your own account with this endpoint",
      );
      expect(deleteUserAccountMock).not.toHaveBeenCalled();
    });
    it("should fail with unknown properties", async () => {
      //WHEN
      const { body } = await mockApp
        .post("/admin/deleteUser")
        .send({ uid: newId(), extra: "value" })
        .set("Authorization", `Bearer ${uid}`)
        .expect(422);

      //THEN
      expect(body).toEqual({
        message: "Invalid request data schema",
        validationErrors: [`Unrecognized key(s) in object: 'extra'`],
      });
    });
    it("should fail for non admin", async () => {
      await expectFailForNonAdmin(
        mockApp
          .post("/admin/deleteUser")
          .send({ uid: newId() })
          .set("Authorization", `Bearer ${uid}`),
      );
    });
    it("should fail if admin endpoints are disabled", async () => {
      await expectFailForDisabledEndpoint(
        mockApp
          .post("/admin/deleteUser")
          .send({ uid: newId() })
          .set("Authorization", `Bearer ${uid}`),
      );
    });
    it("should be rate limited", async () => {
      await expect(
        mockApp
          .post("/admin/deleteUser")
          .send({ uid: newId() })
          .set("Authorization", `Bearer ${uid}`),
      ).toBeRateLimited({ max: 1, windowMs: 5000 });
    });
  });

  describe("clear suspicious", () => {
    const clearSuspiciousMock = vi.spyOn(UserDal, "clearSuspicious");

    beforeEach(() => {
      clearSuspiciousMock.mockClear().mockResolvedValue();
    });

    it("should clear the flag", async () => {
      //GIVEN
      const victimUid = newId();

      //WHEN
      const { body } = await mockApp
        .post("/admin/clearSuspicious")
        .send({ uid: victimUid })
        .set("Authorization", `Bearer ${uid}`)
        .expect(200);

      //THEN
      expect(body).toEqual({
        message: "Suspicious flag cleared",
        data: null,
      });
      expect(clearSuspiciousMock).toHaveBeenCalledWith(victimUid);
      expect(logsAddImportantLog).toHaveBeenCalledWith(
        "admin_suspicious_cleared_by",
        {},
        victimUid,
      );
    });
    it("should fail without uid", async () => {
      const { body } = await mockApp
        .post("/admin/clearSuspicious")
        .send({})
        .set("Authorization", `Bearer ${uid}`)
        .expect(422);
      expect(body.validationErrors).toEqual(['"uid" Required']);
    });
    it("should fail for non admin", async () => {
      await expectFailForNonAdmin(
        mockApp
          .post("/admin/clearSuspicious")
          .send({ uid: newId() })
          .set("Authorization", `Bearer ${uid}`),
      );
    });
  });

  describe("anticheat audits", () => {
    const getLogsMock = vi.spyOn(LogsDal, "getLogs");

    beforeEach(() => {
      getLogsMock.mockClear().mockResolvedValue([
        {
          id: "log",
          uid: "flagged",
          event: "anticheat_flagged",
          timestamp: 1000,
          message: { signals: ["uniform-gaps"] },
        },
      ]);
    });

    it("should list audits of one event", async () => {
      //WHEN
      const { body } = await mockApp
        .get("/admin/anticheat/audits")
        .query({ event: "anticheat_flagged", uid: "flagged", before: 2000 })
        .set("Authorization", `Bearer ${uid}`)
        .expect(200);

      //THEN
      expect(body.data).toEqual([
        {
          id: "log",
          uid: "flagged",
          event: "anticheat_flagged",
          timestamp: 1000,
          message: { signals: ["uniform-gaps"] },
        },
      ]);
      expect(getLogsMock).toHaveBeenCalledWith({
        event: "anticheat_flagged",
        uid: "flagged",
        before: 2000,
        limit: 50,
      });
    });
    it("should only list anticheat events", async () => {
      //WHEN
      const { body } = await mockApp
        .get("/admin/anticheat/audits")
        .query({ event: "user_ban_toggled" })
        .set("Authorization", `Bearer ${uid}`)
        .expect(422);

      //THEN
      expect(body.message).toEqual("Invalid query schema");
      expect(getLogsMock).not.toHaveBeenCalled();
    });
    it("should cap the page size", async () => {
      await mockApp
        .get("/admin/anticheat/audits")
        .query({ event: "anticheat_sample", limit: 101 })
        .set("Authorization", `Bearer ${uid}`)
        .expect(422);
    });
    it("should fail for non admin", async () => {
      await expectFailForNonAdmin(
        mockApp
          .get("/admin/anticheat/audits")
          .query({ event: "anticheat_flagged" })
          .set("Authorization", `Bearer ${uid}`),
      );
    });
    it("should fail if admin endpoints are disabled", async () => {
      await expectFailForDisabledEndpoint(
        mockApp
          .get("/admin/anticheat/audits")
          .query({ event: "anticheat_flagged" })
          .set("Authorization", `Bearer ${uid}`),
      );
    });
  });

  describe("anticheat summary", () => {
    const countLogsMock = vi.spyOn(LogsDal, "countLogs");

    beforeEach(() => {
      countLogsMock.mockClear().mockImplementation(async (event) => {
        if (event === "anticheat_rejected") {
          return [{ key: "score-mismatch", count: 3, users: 2 }];
        }
        if (event === "anticheat_flagged") {
          return [{ key: "uniform-gaps", count: 2, users: 1 }];
        }
        return [
          { key: "time", count: 4, users: 4 },
          { key: "words", count: 1, users: 1 },
        ];
      });
    });

    it("should count rejections by reason and flags by signal", async () => {
      //GIVEN
      const now = Date.now();

      //WHEN
      const { body } = await mockApp
        .get("/admin/anticheat/summary")
        .query({ hours: 2 })
        .set("Authorization", `Bearer ${uid}`)
        .expect(200);

      //THEN
      expect(body.data).toMatchObject({
        rejected: [{ key: "score-mismatch", count: 3, users: 2 }],
        flagged: [{ key: "uniform-gaps", count: 2, users: 1 }],
        samples: 5,
      });
      expect(body.data.since).toBeGreaterThanOrEqual(now - 2 * 3600_000);
      expect(body.data.since).toBeLessThanOrEqual(Date.now() - 2 * 3600_000);
      expect(countLogsMock).toHaveBeenCalledWith(
        "anticheat_flagged",
        body.data.since,
        "$.message.signals",
        true,
      );
    });
    it("should fail for non admin", async () => {
      await expectFailForNonAdmin(
        mockApp
          .get("/admin/anticheat/summary")
          .set("Authorization", `Bearer ${uid}`),
      );
    });
  });

  async function expectFailForNonAdmin(call: TestRequest): Promise<void> {
    isAdminMock.mockResolvedValue(false);
    const { body } = await call.expect(403);
    expect(body.message).toEqual("You don't have permission to do this.");
  }
  async function expectFailForDisabledEndpoint(
    call: TestRequest,
  ): Promise<void> {
    await enableAdminEndpoints(false);
    const { body } = await call.expect(503);
    expect(body.message).toEqual("Admin endpoints are currently disabled.");
  }
});
async function enableAdminEndpoints(enabled: boolean): Promise<void> {
  const mockConfig = await configuration;
  mockConfig.admin = { ...mockConfig.admin, endpointsEnabled: enabled };

  vi.spyOn(Configuration, "getCachedConfiguration").mockResolvedValue(
    mockConfig,
  );
}
