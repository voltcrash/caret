import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { UidSchema } from "@oxytype/schemas/util";
import {
  CommonResponses,
  meta,
  MonkeyResponseSchema,
  responseWithData,
} from "./util/api";

export const ToggleBanRequestSchema = z
  .object({
    uid: UidSchema,
  })
  .strict();
export type ToggleBanRequest = z.infer<typeof ToggleBanRequestSchema>;

export const ClearStreakHourOffsetRequestSchema = z
  .object({
    uid: UidSchema,
  })
  .strict();
export type ClearStreakHourOffsetRequest = z.infer<
  typeof ClearStreakHourOffsetRequestSchema
>;

export const ClearSuspiciousRequestSchema = z
  .object({
    uid: UidSchema,
  })
  .strict();
export type ClearSuspiciousRequest = z.infer<
  typeof ClearSuspiciousRequestSchema
>;

export const ToggleBanResponseSchema = responseWithData(
  z.object({
    banned: z.boolean(),
  }),
).strict();
export type ToggleBanResponse = z.infer<typeof ToggleBanResponseSchema>;

export const DeleteUserRequestSchema = z
  .object({
    uid: UidSchema,
  })
  .strict();
export type DeleteUserRequest = z.infer<typeof DeleteUserRequestSchema>;

export const AcceptReportsRequestSchema = z
  .object({
    reports: z.array(z.object({ reportId: z.string() }).strict()).nonempty(),
  })
  .strict();
export type AcceptReportsRequest = z.infer<typeof AcceptReportsRequestSchema>;

export const RejectReportsRequestSchema = z
  .object({
    reports: z
      .array(
        z
          .object({ reportId: z.string(), reason: z.string().optional() })
          .strict(),
      )
      .nonempty(),
  })
  .strict();
export type RejectReportsRequest = z.infer<typeof RejectReportsRequestSchema>;

export const AnticheatAuditEventSchema = z.enum([
  "anticheat_rejected",
  "anticheat_flagged",
  "anticheat_sample",
]);
export type AnticheatAuditEvent = z.infer<typeof AnticheatAuditEventSchema>;

export const GetAnticheatAuditsQuerySchema = z
  .object({
    event: AnticheatAuditEventSchema,
    uid: UidSchema.optional().describe("Only audits of this user."),
    before: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Only audits older than this timestamp, for paging."),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict();
export type GetAnticheatAuditsQuery = z.infer<
  typeof GetAnticheatAuditsQuerySchema
>;

export const AnticheatAuditSchema = z.object({
  id: z.string(),
  uid: z.string(),
  event: AnticheatAuditEventSchema,
  timestamp: z.number().int().nonnegative(),
  message: z.record(z.string(), z.unknown()),
});
export type AnticheatAudit = z.infer<typeof AnticheatAuditSchema>;

export const GetAnticheatAuditsResponseSchema = responseWithData(
  z.array(AnticheatAuditSchema),
);
export type GetAnticheatAuditsResponse = z.infer<
  typeof GetAnticheatAuditsResponseSchema
>;

export const GetAnticheatSummaryQuerySchema = z
  .object({
    hours: z
      .number()
      .int()
      .min(1)
      .max(24 * 90)
      .default(24),
  })
  .strict();
export type GetAnticheatSummaryQuery = z.infer<
  typeof GetAnticheatSummaryQuerySchema
>;

const AnticheatCountSchema = z.object({
  key: z.string(),
  count: z.number().int().nonnegative(),
  users: z.number().int().nonnegative(),
});
export const AnticheatSummarySchema = z.object({
  since: z.number().int().nonnegative(),
  rejected: z.array(AnticheatCountSchema).describe("Counts by reason."),
  flagged: z.array(AnticheatCountSchema).describe("Counts by signal."),
  samples: z.number().int().nonnegative(),
});
export type AnticheatSummary = z.infer<typeof AnticheatSummarySchema>;
export const GetAnticheatSummaryResponseSchema = responseWithData(
  AnticheatSummarySchema,
);
export type GetAnticheatSummaryResponse = z.infer<
  typeof GetAnticheatSummaryResponseSchema
>;

const c = initContract();
export const adminContract = c.router(
  {
    test: {
      summary: "test permission",
      description: "Check for admin permission for the current user",
      method: "GET",
      path: "",
      responses: {
        200: MonkeyResponseSchema,
      },
    },
    toggleBan: {
      summary: "toggle user ban",
      description: "Ban an unbanned user or unban a banned user.",
      method: "POST",
      path: "/toggleBan",
      body: ToggleBanRequestSchema,
      responses: {
        200: ToggleBanResponseSchema,
      },
    },
    clearStreakHourOffset: {
      summary: "clear streak hour offset",
      description: "Clear the streak hour offset for a user",
      method: "POST",
      path: "/clearStreakHourOffset",
      body: ClearStreakHourOffsetRequestSchema,
      responses: {
        200: MonkeyResponseSchema,
      },
    },
    deleteUser: {
      summary: "delete user",
      description:
        "Delete the account of the given user, including all their data.",
      method: "POST",
      path: "/deleteUser",
      body: DeleteUserRequestSchema,
      responses: {
        200: MonkeyResponseSchema,
      },
    },
    acceptReports: {
      summary: "accept reports",
      description: "Accept one or many reports",
      method: "POST",
      path: "/report/accept",
      body: AcceptReportsRequestSchema,
      responses: {
        200: MonkeyResponseSchema,
      },
    },
    rejectReports: {
      summary: "reject reports",
      description: "Reject one or many reports",
      method: "POST",
      path: "/report/reject",
      body: RejectReportsRequestSchema,
      responses: {
        200: MonkeyResponseSchema,
      },
    },
    clearSuspicious: {
      summary: "clear suspicious flag",
      description:
        "Clear the suspicious flag set by repeated anticheat review flags after reviewing them.",
      method: "POST",
      path: "/clearSuspicious",
      body: ClearSuspiciousRequestSchema,
      responses: {
        200: MonkeyResponseSchema,
      },
    },
    getAnticheatAudits: {
      summary: "list anticheat audits",
      description:
        "Recent anticheat rejections, review flags or timing samples, newest first.",
      method: "GET",
      path: "/anticheat/audits",
      query: GetAnticheatAuditsQuerySchema,
      responses: {
        200: GetAnticheatAuditsResponseSchema,
      },
    },
    getAnticheatSummary: {
      summary: "summarise anticheat audits",
      description:
        "Rejections by reason and review flags by signal over a recent window.",
      method: "GET",
      path: "/anticheat/summary",
      query: GetAnticheatSummaryQuerySchema,
      responses: {
        200: GetAnticheatSummaryResponseSchema,
      },
    },
  },
  {
    pathPrefix: "/admin",
    strictStatusCodes: true,
    metadata: meta({
      openApiTags: "admin",
      authenticationOptions: { noCache: true },
      rateLimit: "adminLimit",
      requirePermission: "admin",
      requireConfiguration: {
        path: "admin.endpointsEnabled",
        invalidMessage: "Admin endpoints are currently disabled.",
      },
    }),

    commonResponses: CommonResponses,
  },
);
