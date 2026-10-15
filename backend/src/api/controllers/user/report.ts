import { verifyCaptcha } from "./captcha";
import { MonkeyResponse } from "../../../utils/monkey-response";
import { randomUUID } from "node:crypto";
import { newId } from "../../../utils/id";
import * as ReportDAL from "../../../dal/report";
import { ReportUserRequest } from "@oxytype/contracts/users";
import { MonkeyRequest } from "../../types";

export async function reportUser(
  req: MonkeyRequest<undefined, ReportUserRequest>,
): Promise<MonkeyResponse> {
  const { uid } = req.ctx.decodedToken;
  const {
    reporting: { maxReports, contentReportLimit },
  } = req.ctx.configuration.quotes;

  const { uid: uidToReport, reason, comment, captcha } = req.body;

  await verifyCaptcha(captcha, "user-report");

  const newReport: ReportDAL.DBReport = {
    _id: newId(),
    id: randomUUID(),
    type: "user",
    timestamp: new Date().getTime(),
    uid,
    contentId: `${uidToReport}`,
    reason,
    comment: comment ?? "",
  };

  await ReportDAL.createReport(newReport, maxReports, contentReportLimit);

  return new MonkeyResponse("User reported", null);
}
