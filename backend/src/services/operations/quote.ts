import { tryCatch } from "@oxytype/util/trycatch";
import type { CaptchaAction } from "@oxytype/contracts/captcha";
import { atomicUser } from "../../db/mutation";
import { randomUUID } from "node:crypto";
import { getPartialUser, updateQuoteRatings } from "../../dal/user";
import * as ReportDAL from "../../dal/report";
import * as NewQuotesDAL from "../../dal/new-quotes";
import * as QuoteRatingsDAL from "../../dal/quote-ratings";
import MonkeyError from "../../utils/error";
import { verify } from "../../utils/captcha";
import { MonkeyResponse } from "../../utils/monkey-response";
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
} from "@oxytype/contracts/quotes";
import type { ServiceContext, OperationInput } from "../context";
import { Language } from "@oxytype/schemas/languages";

async function verifyCaptcha(
  captcha: string,
  action: CaptchaAction,
): Promise<void> {
  const { data: verified, error } = await tryCatch(verify(captcha, action));
  if (error) {
    throw new MonkeyError(
      422,
      "Captcha verification unavailable, please try again",
    );
  }
  if (!verified) {
    throw new MonkeyError(422, "Captcha check failed");
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
  return new MonkeyResponse("Quote submissions retrieved", data);
}

export async function isSubmissionEnabled(
  context: ServiceContext,
  _input: OperationInput,
): Promise<IsSubmissionEnabledResponse> {
  const { submissionsEnabled } = context.configuration.quotes;
  return new MonkeyResponse(
    `Quote submission ${submissionsEnabled ? "enabled" : "disabled"}`,
    { isEnabled: submissionsEnabled },
  );
}

export async function addQuote(
  context: ServiceContext,
  input: OperationInput<undefined, AddQuoteRequest>,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;
  const { text, source, language, captcha } = input.body;

  await verifyCaptcha(captcha, "quote-submit");

  await NewQuotesDAL.add(text, source, language, uid);
  return new MonkeyResponse("Quote submission added", null);
}

export async function approveQuote(
  context: ServiceContext,
  input: OperationInput<undefined, ApproveQuoteRequest>,
): Promise<ApproveQuoteResponse> {
  const { uid } = context.actor;
  const { quoteId, editText, editSource } = input.body;

  const { name } = await getPartialUser(uid, "approve quote", ["name"]);

  if (!name) {
    throw new MonkeyError(500, "Missing name field");
  }

  const data = await NewQuotesDAL.approve(quoteId, editText, editSource, name);
  void addLog("system_quote_approved", data, uid);

  return new MonkeyResponse(data.message, data.quote);
}

export async function refuseQuote(
  _context: ServiceContext,
  input: OperationInput<undefined, RejectQuoteRequest>,
): Promise<MonkeyResponse> {
  const { quoteId } = input.body;

  await NewQuotesDAL.refuse(quoteId);
  return new MonkeyResponse("Quote refused", null);
}

export async function getRating(
  _context: ServiceContext,
  input: OperationInput<GetQuoteRatingQuery>,
): Promise<GetQuoteRatingResponse> {
  const { quoteId, language } = input.query;

  const data = await QuoteRatingsDAL.get(quoteId, language);

  return new MonkeyResponse("Rating retrieved", data);
}

export async function submitRating(
  context: ServiceContext,
  input: OperationInput<undefined, AddQuoteRatingRequest>,
): Promise<MonkeyResponse> {
  return await atomicUser(
    context.actor.uid,
    async () => await submitRatingAtomic(context, input),
  );
}
async function submitRatingAtomic(
  context: ServiceContext,
  input: OperationInput<undefined, AddQuoteRatingRequest>,
): Promise<MonkeyResponse> {
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
  return new MonkeyResponse(responseMessage, null);
}

export async function reportQuote(
  context: ServiceContext,
  input: OperationInput<undefined, ReportQuoteRequest>,
): Promise<MonkeyResponse> {
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

  return new MonkeyResponse("Quote reported", null);
}
