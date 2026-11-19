import { verifyCaptcha } from "./captcha";
import { ApiResponse } from "../../../utils/api-response";
import { randomUUID } from "node:crypto";
import { newId } from "../../../utils/id";
import * as ReportDAL from "../../../dal/report";
import { ReportUserRequest } from "@caret/contracts/users";
import type { ServiceContext, OperationInput } from "../../context";

export async function reportUser(
  context: ServiceContext,
  input: OperationInput<undefined, ReportUserRequest>,
): Promise<ApiResponse> {
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

  return new ApiResponse("User reported", null);
}
