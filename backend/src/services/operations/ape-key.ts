import { randomBytes } from "node:crypto";
import { hashApeKey } from "../../utils/ape-key-hash";
import * as ApeKeysDAL from "../../dal/ape-keys";
import MonkeyError from "../../utils/error";
import { MonkeyResponse } from "../../utils/monkey-response";
import { base64UrlEncode, omit } from "../../utils/misc";
import { newId } from "../../utils/id";

import {
  AddApeKeyRequest,
  AddApeKeyResponse,
  ApeKeyParams,
  EditApeKeyRequest,
  GetApeKeyResponse,
} from "@oxytype/contracts/ape-keys";
import { ApeKey } from "@oxytype/schemas/ape-keys";
import type { ServiceContext, OperationInput } from "../context";

function cleanApeKey(apeKey: ApeKeysDAL.DBApeKey): ApeKey {
  return omit(apeKey, ["hash", "_id", "uid", "useCount"]);
}

export async function getApeKeys(
  context: ServiceContext,
  _input: OperationInput,
): Promise<GetApeKeyResponse> {
  const { uid } = context.actor;

  const apeKeys = await ApeKeysDAL.getApeKeys(uid);
  const cleanedKeys: Record<string, ApeKey> = Object.fromEntries(
    apeKeys.map((item) => [item._id, cleanApeKey(item)]),
  );

  return new MonkeyResponse("ApeKeys retrieved", cleanedKeys);
}

export async function generateApeKey(
  context: ServiceContext,
  input: OperationInput<undefined, AddApeKeyRequest>,
): Promise<AddApeKeyResponse> {
  const { name, enabled } = input.body;
  const { uid } = context.actor;
  const { maxKeysPerUser, apeKeyBytes } = context.configuration.apeKeys;

  const currentNumberOfApeKeys = await ApeKeysDAL.countApeKeysForUser(uid);

  if (currentNumberOfApeKeys >= maxKeysPerUser) {
    throw new MonkeyError(409, "Maximum number of ApeKeys have been generated");
  }

  const apiKey = randomBytes(apeKeyBytes).toString("base64url");
  const saltyHash = hashApeKey(apiKey);

  const apeKey: ApeKeysDAL.DBApeKey = {
    _id: newId(),
    name,
    enabled,
    uid,
    hash: saltyHash,
    createdOn: Date.now(),
    modifiedOn: Date.now(),
    lastUsedOn: -1,
    useCount: 0,
  };

  const apeKeyId = await ApeKeysDAL.addApeKey(apeKey, maxKeysPerUser);

  return new MonkeyResponse("ApeKey generated", {
    apeKey: base64UrlEncode(`${apeKeyId}.${apiKey}`),
    apeKeyId,
    apeKeyDetails: cleanApeKey(apeKey),
  });
}

export async function editApeKey(
  context: ServiceContext,
  input: OperationInput<undefined, EditApeKeyRequest, ApeKeyParams>,
): Promise<MonkeyResponse> {
  const { apeKeyId } = input.params;
  const { name, enabled } = input.body;
  const { uid } = context.actor;

  await ApeKeysDAL.editApeKey(uid, apeKeyId, name, enabled);

  return new MonkeyResponse("ApeKey updated", null);
}

export async function deleteApeKey(
  context: ServiceContext,
  input: OperationInput<undefined, undefined, ApeKeyParams>,
): Promise<MonkeyResponse> {
  const { apeKeyId } = input.params;
  const { uid } = context.actor;

  await ApeKeysDAL.deleteApeKey(uid, apeKeyId);

  return new MonkeyResponse("ApeKey deleted", null);
}
