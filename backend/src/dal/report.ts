import { inArray } from "drizzle-orm";
import { database, statement, encode, isUniqueViolation } from "../db/client";
import { reports } from "../db/schema";
import MonkeyError from "../utils/error";
export type DBReport = {
  _id: string;
  id: string;
  type: "quote" | "user";
  timestamp: number;
  uid: string;
  contentId: string;
  reason: string;
  comment: string;
};
export async function getReports(ids: string[]): Promise<DBReport[]> {
  if (!ids.length) return [];
  return (
    await database()
      .select()
      .from(reports)
      .where(inArray(reports.reportId, ids))
  ).map((row) => ({ ...row.data, _id: row.id, id: row.reportId }) as DBReport);
}
export async function deleteReports(ids: string[]): Promise<void> {
  if (ids.length) {
    await database().delete(reports).where(inArray(reports.reportId, ids));
  }
}
export async function createReport(
  report: DBReport,
  maxReports: number,
  contentReportLimit: number,
): Promise<void> {
  if (report.type === "user" && report.contentId === report.uid) {
    throw new MonkeyError(400, "You cannot report yourself.");
  }
  try {
    const result = await statement(
      "INSERT INTO reports(id,report_id,uid,content_id,type,timestamp,data) SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM reports) < ? AND (SELECT count(*) FROM reports WHERE content_id=?) < ?",
      report._id,
      report.id,
      report.uid,
      report.contentId,
      report.type,
      report.timestamp,
      encode(report),
      maxReports,
      report.contentId,
      contentReportLimit,
    ).run();
    if (!result.rowCount) {
      const count = await statement(
        "SELECT count(*) AS count FROM reports",
      ).first<number>("count");
      throw new MonkeyError(
        (count ?? 0) >= maxReports ? 503 : 409,
        (count ?? 0) >= maxReports
          ? "Reports are not being accepted at this time due to a large backlog of reports. Please try again later."
          : "A report limit for this content has been reached.",
      );
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new MonkeyError(409, "You have already reported this content.");
    }
    throw error;
  }
}
