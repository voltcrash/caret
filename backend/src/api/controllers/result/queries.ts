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

import { MonkeyRequest } from "../../types";

export async function getResults(
  req: MonkeyRequest<GetResultsQuery>,
): Promise<GetResultsResponse> {
  const { uid } = req.ctx.decodedToken;
  const premiumFeaturesEnabled = req.ctx.configuration.users.premium.enabled;
  const { onOrAfterTimestamp = NaN, offset = 0 } = req.query;
  const userHasPremium = await UserDAL.checkIfUserIsPremium(uid);

  const maxLimit =
    premiumFeaturesEnabled && userHasPremium
      ? req.ctx.configuration.results.limits.premiumUser
      : req.ctx.configuration.results.limits.regularUser;

  let limit =
    req.query.limit ??
    Math.min(req.ctx.configuration.results.maxBatchSize, maxLimit);

  //check if premium features are disabled and current call exceeds the limit for regular users
  if (
    userHasPremium &&
    !premiumFeaturesEnabled &&
    limit + offset > req.ctx.configuration.results.limits.regularUser
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
    client: req.query.client,
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
  req: MonkeyRequest<undefined, undefined, GetResultByIdPath>,
): Promise<GetResultByIdResponse> {
  const { uid } = req.ctx.decodedToken;
  const { resultId } = req.params;

  const result = await ResultDAL.getResult(uid, resultId);
  return new MonkeyResponse("Result retrieved", result);
}

export async function getLastResult(
  req: MonkeyRequest<ClientQuery>,
): Promise<GetLastResultResponse> {
  const { uid } = req.ctx.decodedToken;
  const result = await ResultDAL.getLastResult(uid, req.query?.client);
  return new MonkeyResponse("Result retrieved", result);
}

export async function updateTags(
  req: MonkeyRequest<undefined, UpdateResultTagsRequest>,
): Promise<UpdateResultTagsResponse> {
  const { uid } = req.ctx.decodedToken;
  const { tagIds, resultId } = req.body;

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
