import { tryCatch } from "@caret/util/trycatch";
import type { CaptchaAction } from "@caret/contracts/captcha";
import { atomicUser } from "../../db/mutation";
import { randomUUID } from "node:crypto";
import { getPartialUser, updateQuoteRatings } from "../../dal/user";
import * as ReportDAL from "../../dal/report";
import * as NewQuotesDAL from "../../dal/new-quotes";
import * as QuoteRatingsDAL from "../../dal/quote-ratings";
import ApiError from "../../utils/error";
import { verify } from "../../utils/captcha";
import { ApiResponse } from "../../utils/api-response";
import { newId } from "../../utils/id";
import { addLog } from "../../dal/logs";
import {
  AddQuoteRatingRequest,
  AddQuoteRequest,
  ApproveQuoteRequest,
  ApproveQuoteResponse,
  GetQuoteRatingQuery,
  GetQuoteRatingResponse,
  GetQuotesResponse,
  IsSubmissionEnabledResponse,
  RejectQuoteRequest,
  ReportQuoteRequest,
} from "@caret/contracts/quotes";
import type { ServiceContext, OperationInput } from "../context";
import { Language } from "@caret/schemas/languages";

async function verifyCaptcha(
  captcha: string,
  action: CaptchaAction,
): Promise<void> {
  const { data: verified, error } = await tryCatch(verify(captcha, action));
  if (error) {
    throw new ApiError(
      422,
      "Captcha verification unavailable, please try again",
    );
  }
  if (!verified) {
    throw new ApiError(422, "Captcha check failed");
  }
}

export async function getQuotes(
  context: ServiceContext,
  _input: OperationInput,
): Promise<GetQuotesResponse> {
  const { uid } = context.actor;
  const quoteMod = (await getPartialUser(uid, "get quotes", ["quoteMod"]))
    .quoteMod;
  const quoteModLanguage = quoteMod === true ? "all" : (quoteMod as Language);

  const data = await NewQuotesDAL.get(quoteModLanguage);
  return new ApiResponse("Quote submissions retrieved", data);
}

export async function isSubmissionEnabled(
  context: ServiceContext,
  _input: OperationInput,
): Promise<IsSubmissionEnabledResponse> {
  const { submissionsEnabled } = context.configuration.quotes;
  return new ApiResponse(
    `Quote submission ${submissionsEnabled ? "enabled" : "disabled"}`,
    { isEnabled: submissionsEnabled },
  );
}

export async function addQuote(
  context: ServiceContext,
  input: OperationInput<undefined, AddQuoteRequest>,
): Promise<ApiResponse> {
  const { uid } = context.actor;
  const { text, source, language, captcha } = input.body;

  const { banned } = await getPartialUser(uid, "add quote", ["banned"]);
  if (banned === true) {
    throw new ApiError(403, "Banned users cannot submit quotes");
  }

  await verifyCaptcha(captcha, "quote-submit");

  const result = await NewQuotesDAL.add(text, source, language, uid);
  if (result?.languageError !== undefined && result.languageError !== 0) {
    throw new ApiError(400, "Language not found");
  }
  if (result?.duplicateId !== undefined) {
    throw new ApiError(
      409,
      `Duplicate quote (similar to quote #${result.duplicateId})`,
    );
  }
  return new ApiResponse("Quote submission added", null);
}

/** Language-scoped moderators may only review submissions in their language. */
async function assertQuoteModScope(
  quoteMod: boolean | string | undefined,
  quoteId: string,
): Promise<void> {
  if (quoteMod === true) return;
  const language = await NewQuotesDAL.getLanguage(quoteId);
  if (language !== undefined && language !== quoteMod) {
    throw new ApiError(403, "You don't have permission to do this.");
  }
}

export async function approveQuote(
  context: ServiceContext,
  input: OperationInput<undefined, ApproveQuoteRequest>,
): Promise<ApproveQuoteResponse> {
  const { uid } = context.actor;
  const { quoteId, editText, editSource } = input.body;

  const { name, quoteMod } = await getPartialUser(uid, "approve quote", [
    "name",
    "quoteMod",
  ]);
  await assertQuoteModScope(quoteMod, quoteId);

  if (!name) {
    throw new ApiError(500, "Missing name field");
  }

  const data = await NewQuotesDAL.approve(quoteId, editText, editSource, name);
  await addLog("system_quote_approved", data, uid);

  return new ApiResponse(data.message, data.quote);
}

export async function refuseQuote(
  context: ServiceContext,
  input: OperationInput<undefined, RejectQuoteRequest>,
): Promise<ApiResponse> {
  const { quoteId } = input.body;
  const { quoteMod } = await getPartialUser(context.actor.uid, "refuse quote", [
    "quoteMod",
  ]);
  await assertQuoteModScope(quoteMod, quoteId);

  await NewQuotesDAL.refuse(quoteId);
  return new ApiResponse("Quote refused", null);
}

export async function getRating(
  _context: ServiceContext,
  input: OperationInput<GetQuoteRatingQuery>,
): Promise<GetQuoteRatingResponse> {
  const { quoteId, language } = input.query;

  const data = await QuoteRatingsDAL.get(quoteId, language);

  return new ApiResponse("Rating retrieved", data);
}

export async function submitRating(
  context: ServiceContext,
  input: OperationInput<undefined, AddQuoteRatingRequest>,
): Promise<ApiResponse> {
  return await atomicUser(
    context.actor.uid,
    async () => await submitRatingAtomic(context, input),
  );
}
async function submitRatingAtomic(
  context: ServiceContext,
  input: OperationInput<undefined, AddQuoteRatingRequest>,
): Promise<ApiResponse> {
  const { uid } = context.actor;
  const { quoteId, rating, language } = input.body;

  const user = await getPartialUser(uid, "submit rating", ["quoteRatings"]);

  const userQuoteRatings = user.quoteRatings ?? {};
  const currentRating = userQuoteRatings[language]?.[quoteId] ?? 0;

  const newRating = rating - currentRating;
  const shouldUpdateRating = currentRating !== 0;

  await QuoteRatingsDAL.submit(
    quoteId,
    language,
    newRating,
    shouldUpdateRating,
  );

  userQuoteRatings[language] ??= {};
  userQuoteRatings[language][quoteId] = rating;

  await updateQuoteRatings(uid, userQuoteRatings);

  const responseMessage = `Rating ${
    shouldUpdateRating ? "updated" : "submitted"
  }`;
  return new ApiResponse(responseMessage, null);
}

export async function reportQuote(
  context: ServiceContext,
  input: OperationInput<undefined, ReportQuoteRequest>,
): Promise<ApiResponse> {
  const { uid } = context.actor;
  const {
    reporting: { maxReports, contentReportLimit },
  } = context.configuration.quotes;

  const { quoteId, quoteLanguage, reason, comment, captcha } = input.body;

  await verifyCaptcha(captcha, "quote-report");

  const newReport: ReportDAL.DBReport = {
    _id: newId(),
    id: randomUUID(),
    type: "quote",
    timestamp: new Date().getTime(),
    uid,
    contentId: `${quoteLanguage}-${quoteId}`,
    reason,
    comment: comment ?? "",
  };

  await ReportDAL.createReport(newReport, maxReports, contentReportLimit);

  return new ApiResponse("Quote reported", null);
}
