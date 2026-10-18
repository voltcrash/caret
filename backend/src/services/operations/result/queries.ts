import type { ClientQuery } from "@oxytype/schemas/shared";

import { atomicUser } from "../../../db/mutation";
import * as ResultDAL from "../../../dal/result";

import { MonkeyResponse } from "../../../utils/monkey-response";
import MonkeyError from "../../../utils/error";

import * as UserDAL from "../../../dal/user";

import { addLog } from "../../../dal/logs";
import {
  GetLastResultResponse,
  GetResultByIdPath,
  GetResultByIdResponse,
  GetResultsQuery,
  GetResultsResponse,
  UpdateResultTagsRequest,
  UpdateResultTagsResponse,
} from "@oxytype/contracts/results";

import type { ServiceContext, OperationInput } from "../../context";

export async function getResults(
  context: ServiceContext,
  input: OperationInput<GetResultsQuery>,
): Promise<GetResultsResponse> {
  const { uid } = context.actor;
  const premiumFeaturesEnabled = context.configuration.users.premium.enabled;
  const { onOrAfterTimestamp = NaN, offset = 0 } = input.query;
  const userHasPremium = await UserDAL.checkIfUserIsPremium(uid);

  const maxLimit =
    premiumFeaturesEnabled && userHasPremium
      ? context.configuration.results.limits.premiumUser
      : context.configuration.results.limits.regularUser;

  let limit =
    input.query.limit ??
    Math.min(context.configuration.results.maxBatchSize, maxLimit);

  //check if premium features are disabled and current call exceeds the limit for regular users
  if (
    userHasPremium &&
    !premiumFeaturesEnabled &&
    limit + offset > context.configuration.results.limits.regularUser
  ) {
    throw new MonkeyError(503, "Premium feature disabled.");
  }

  if (limit + offset > maxLimit) {
    if (offset < maxLimit) {
      //batch is partly in the allowed ranged. Set the limit to the max allowed and return partly results.
      limit = maxLimit - offset;
    } else {
      throw new MonkeyError(422, `Max results limit of ${maxLimit} exceeded.`);
    }
  }

  const results = await ResultDAL.getResults(uid, {
    onOrAfterTimestamp,
    client: input.query.client,
    limit,
    offset,
  });
  await addLog(
    "user_results_requested",
    {
      limit,
      offset,
      onOrAfterTimestamp,
      isPremium: userHasPremium,
    },
    uid,
  );

  return new MonkeyResponse("Results retrieved", results);
}

export async function getResultById(
  context: ServiceContext,
  input: OperationInput<undefined, undefined, GetResultByIdPath>,
): Promise<GetResultByIdResponse> {
  const { uid } = context.actor;
  const { resultId } = input.params;

  const result = await ResultDAL.getResult(uid, resultId);
  return new MonkeyResponse("Result retrieved", result);
}

export async function getLastResult(
  context: ServiceContext,
  input: OperationInput<ClientQuery>,
): Promise<GetLastResultResponse> {
  const { uid } = context.actor;
  const result = await ResultDAL.getLastResult(uid, input.query?.client);
  return new MonkeyResponse("Result retrieved", result);
}

export async function updateTags(
  context: ServiceContext,
  input: OperationInput<undefined, UpdateResultTagsRequest>,
): Promise<UpdateResultTagsResponse> {
  const { uid } = context.actor;
  const { tagIds, resultId } = input.body;

  return await atomicUser(uid, async () => {
    await ResultDAL.updateTags(uid, resultId, tagIds);
    const result = await ResultDAL.getResult(uid, resultId);

    result.tags = tagIds;
    result.difficulty ??= "normal";
    result.language ??= "english";
    result.funbox ??= [];
    result.lazyMode ??= false;
    result.punctuation ??= false;
    result.numbers ??= false;

    const user = await UserDAL.getPartialUser(uid, "update tags", ["tags"]);
    const tagPbs = await UserDAL.checkIfTagPb(uid, user, result);
    return new MonkeyResponse("Result tags updated", {
      tagPbs,
    });
  });
}
