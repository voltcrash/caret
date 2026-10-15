import { verifyCaptcha } from "./captcha";
import { MonkeyResponse } from "../../../utils/monkey-response";
import { randomUUID } from "node:crypto";
import { newId } from "../../../utils/id";
import * as ReportDAL from "../../../dal/report";
import { ReportUserRequest } from "@oxytype/contracts/users";
import type { ServiceContext, OperationInput } from "../../context";

export async function reportUser(
  context: ServiceContext,
  input: OperationInput<undefined, ReportUserRequest>,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;
  const {
    reporting: { maxReports, contentReportLimit },
  } = context.configuration.quotes;

  const { uid: uidToReport, reason, comment, captcha } = input.body;

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
