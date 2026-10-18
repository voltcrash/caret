import { MonkeyResponse } from "../../utils/monkey-response";
import { buildMonkeyMail } from "../../utils/monkey-mail";
import * as UserDAL from "../../dal/user";
import * as ReportDAL from "../../dal/report";
import {
  AcceptReportsRequest,
  AnticheatAuditEvent,
  ClearStreakHourOffsetRequest,
  ClearSuspiciousRequest,
  DeleteUserRequest,
  GetAnticheatAuditsQuery,
  GetAnticheatAuditsResponse,
  GetAnticheatSummaryQuery,
  GetAnticheatSummaryResponse,
  RejectReportsRequest,
  ToggleBanRequest,
  ToggleBanResponse,
} from "@oxytype/contracts/admin";
import MonkeyError, { getErrorMessage } from "../../utils/error";
import { Configuration } from "@oxytype/schemas/configuration";
import { addImportantLog, countLogs, getLogs } from "../../dal/logs";
import type { ServiceContext, OperationInput } from "../context";
import { purgeUserFromDailyLeaderboards } from "../../utils/daily-leaderboards";
import { purgeUserFromXpLeaderboards } from "../../services/weekly-xp-leaderboard";
import { deleteUserAccount } from "../../services/user-deletion";

export async function test(
  _context: ServiceContext,
  _input: OperationInput,
): Promise<MonkeyResponse> {
  return new MonkeyResponse("OK", null);
}

export async function toggleBan(
  context: ServiceContext,
  input: OperationInput<undefined, ToggleBanRequest>,
): Promise<ToggleBanResponse> {
  const { uid } = input.body;

  const user = await UserDAL.getPartialUser(uid, "toggle ban", ["banned"]);

  const banning = !user.banned;

  await UserDAL.setBanned(uid, banning);

  if (banning) {
    await Promise.all([
      purgeUserFromDailyLeaderboards(
        uid,
        context.configuration.dailyLeaderboards,
      ),
      purgeUserFromXpLeaderboards(
        uid,
        context.configuration.leaderboards.weeklyXp,
      ),
    ]);
  }

  void addImportantLog("user_ban_toggled", { banned: banning }, uid);

  return new MonkeyResponse(`Ban toggled`, {
    banned: banning,
  });
}

export async function clearStreakHourOffset(
  _context: ServiceContext,
  input: OperationInput<undefined, ClearStreakHourOffsetRequest>,
): Promise<MonkeyResponse> {
  const { uid } = input.body;

  await UserDAL.clearStreakHourOffset(uid);
  void addImportantLog("admin_streak_hour_offset_cleared_by", {}, uid);

  return new MonkeyResponse("Streak hour offset cleared", null);
}

export async function deleteUser(
  context: ServiceContext,
  input: OperationInput<undefined, DeleteUserRequest>,
): Promise<MonkeyResponse> {
  const { uid } = input.body;

  if (uid === context.actor.uid) {
    throw new MonkeyError(
      403,
      "You cannot delete your own account with this endpoint",
    );
  }

  const userInfo = await deleteUserAccount(uid, context.configuration);

  void addImportantLog(
    "user_deleted_by_admin",
    `${userInfo?.email} ${userInfo?.name}`,
    uid,
  );

  return new MonkeyResponse("User deleted", null);
}

export async function acceptReports(
  context: ServiceContext,
  input: OperationInput<undefined, AcceptReportsRequest>,
): Promise<MonkeyResponse> {
  await handleReports(
    input.body.reports.map((it) => ({ ...it })),
    true,
    context.configuration.users.inbox,
  );
  return new MonkeyResponse("Reports removed and users notified.", null);
}

export async function rejectReports(
  context: ServiceContext,
  input: OperationInput<undefined, RejectReportsRequest>,
): Promise<MonkeyResponse> {
  await handleReports(
    input.body.reports.map((it) => ({ ...it })),
    false,
    context.configuration.users.inbox,
  );
  return new MonkeyResponse("Reports removed and users notified.", null);
}

async function handleReports(
  reports: { reportId: string; reason?: string }[],
  accept: boolean,
  inboxConfig: Configuration["users"]["inbox"],
): Promise<void> {
  const reportIds = reports.map(({ reportId }) => reportId);

  const reportsFromDb = await ReportDAL.getReports(reportIds);
  const reportById = new Map(reportsFromDb.map((it) => [it.id, it]));

  const existingReportIds = new Set(reportsFromDb.map((report) => report.id));
  const missingReportIds = reportIds.filter(
    (reportId) => !existingReportIds.has(reportId),
  );

  if (missingReportIds.length > 0) {
    throw new MonkeyError(
      404,
      `Reports not found for some IDs ${missingReportIds.join(",")}`,
    );
  }

  await ReportDAL.deleteReports(reportIds);

  for (const { reportId, reason } of reports) {
    try {
      const report = reportById.get(reportId);
      if (!report) {
        throw new MonkeyError(404, `Report not found for ID: ${reportId}`);
      }

      let mailBody = "";
      if (accept) {
        mailBody = `Your report regarding ${report.type} ${
          report.contentId
        } (${report.reason.toLowerCase()}) has been approved. Thank you.`;
      } else {
        mailBody = `Sorry, but your report regarding ${report.type} ${
          report.contentId
        } (${report.reason.toLowerCase()}) has been denied. ${
          reason !== undefined ? `\nReason: ${reason}` : ""
        }`;
      }

      const mailSubject = accept ? "Report approved" : "Report denied";
      const mail = buildMonkeyMail({
        subject: mailSubject,
        body: mailBody,
      });
      await UserDAL.addToInbox(report.uid, [mail], inboxConfig);
    } catch (e) {
      if (e instanceof MonkeyError) {
        throw new MonkeyError(e.status, e.message);
      } else {
        throw new MonkeyError(
          500,
          `Error handling reports: ${getErrorMessage(e)}`,
        );
      }
    }
  }
}

export async function clearSuspicious(
  _context: ServiceContext,
  input: OperationInput<undefined, ClearSuspiciousRequest>,
): Promise<MonkeyResponse> {
  const { uid } = input.body;

  await UserDAL.clearSuspicious(uid);
  void addImportantLog("admin_suspicious_cleared_by", {}, uid);

  return new MonkeyResponse("Suspicious flag cleared", null);
}

export async function getAnticheatAudits(
  _context: ServiceContext,
  input: OperationInput<GetAnticheatAuditsQuery>,
): Promise<GetAnticheatAuditsResponse> {
  const audits = await getLogs(input.query);
  return new MonkeyResponse(
    "Anticheat audits retrieved",
    audits.map((audit) => ({
      ...audit,
      event: audit.event as AnticheatAuditEvent,
    })),
  );
}

export async function getAnticheatSummary(
  _context: ServiceContext,
  input: OperationInput<GetAnticheatSummaryQuery>,
): Promise<GetAnticheatSummaryResponse> {
  const since = Date.now() - input.query.hours * 60 * 60 * 1000;
  const [rejected, flagged, samples] = await Promise.all([
    countLogs("anticheat_rejected", since, "$.message.reason"),
    countLogs("anticheat_flagged", since, "$.message.signals", true),
    countLogs("anticheat_sample", since, "$.message.mode"),
  ]);
  return new MonkeyResponse("Anticheat summary retrieved", {
    since,
    rejected,
    flagged,
    samples: samples.reduce((sum, row) => sum + row.count, 0),
  });
}
