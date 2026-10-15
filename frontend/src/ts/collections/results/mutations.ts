import { resultsByClient, getResults } from "./store";
import { normalizeResult } from "./normalize";
import { UpdateTagsResult, ActionType } from "./types";
import { Client } from "@oxytype/schemas/shared";
import { createOptimisticAction } from "@tanstack/solid-db";
import Ape from "../../ape";
import { getLastResult } from "../../states/snapshot";
import { reconcileLocalTagPB, saveLocalTagPB } from "../tags";

function createActions(client: Client) {
  const resultsCollection = resultsByClient[client];
  const actions = {
    updateTags: createOptimisticAction<
      ActionType["updateTags"] & { persisted: UpdateTagsResult }
    >({
      onMutate: ({ resultId, newTagIds }) => {
        resultsCollection().update(resultId, (result) => {
          result.tags = newTagIds;
        });
      },
      mutationFn: async ({ resultId, currentTagIds, newTagIds, persisted }) => {
        const response = await Ape.results.updateTags({
          body: { resultId, tagIds: newTagIds },
        });
        if (response.status !== 200) {
          throw new Error(
            `Failed to update result tag: ${response.body.message}`,
          );
        }
        const results = getResults(client);
        const result = results.find((it) => it._id === resultId);

        if (result === undefined) {
          throw new Error(`Cannot find result with id ${resultId}`);
        }

        const tagsToUpdate = [
          ...currentTagIds.filter((tag) => !newTagIds.includes(tag)),
          ...newTagIds.filter((tag) => !currentTagIds.includes(tag)),
        ];
        if (client === "web") {
          tagsToUpdate.forEach((tag) => {
            reconcileLocalTagPB(
              tag,
              result.mode,
              result.mode2,
              result.punctuation,
              result.numbers,
              result.language,
              result.difficulty,
              result.lazyMode,
              results,
            );
          });
        }

        resultsCollection().utils.writeUpdate({
          _id: resultId,
          tags: newTagIds,
        });

        persisted.tagPbs = response.body.data.tagPbs;
      },
    }),
    insertLocalResult: createOptimisticAction<ActionType["insertLocalResult"]>({
      onMutate: ({ result }) => {
        resultsCollection().utils.writeInsert(normalizeResult(result));
      },
      mutationFn: async () => {
        //we don't sync the changes back to the backend here, it is done already
        return;
      },
    }),
    deleteLocalTag: createOptimisticAction<ActionType["deleteLocalTag"]>({
      onMutate: ({ tagId }) => {
        for (const result of [...resultsCollection().values()].filter((it) =>
          it.tags.includes(tagId),
        )) {
          resultsCollection().utils.writeUpdate({
            ...result,
            tags: result.tags.filter((it) => it !== tagId),
          });
        }
      },
      mutationFn: async () => {
        //we do not sync the changes back to the backend
        return;
      },
    }),
  };
  return actions;
}

const actionsByClient = {
  web: createActions("web"),
  tui: createActions("tui"),
};

// --- Public API ---
/**
 * @returns ids of tags that got a new personal best from this result
 */
export async function updateTags(
  params: ActionType["updateTags"],
): Promise<UpdateTagsResult> {
  const resultsCollection = resultsByClient[params.client ?? "web"];
  if (!resultsCollection().isReady()) {
    // if its not ready yet, send the api request to update the tags
    const response = await Ape.results.updateTags({
      body: { resultId: params.resultId, tagIds: params.newTagIds },
    });

    if (response.status !== 200) {
      throw new Error(`Failed to update result tag: ${response.body.message}`);
    }

    if (params.client === "tui") {
      return { tagPbs: response.body.data.tagPbs };
    }

    const result = getLastResult();

    if (result === undefined) {
      throw new Error(`Cannot find result with id ${params.resultId}`);
    }

    if (result._id !== params.resultId) {
      throw new Error(
        `Last result id ${result._id} does not match updated result id ${params.resultId}. Call the devs and tell them to fix their ugly code`,
      );
    }

    response.body.data.tagPbs.forEach((tag) => {
      saveLocalTagPB(
        tag,
        result.mode,
        result.mode2,
        result.punctuation,
        result.numbers,
        result.language,
        result.difficulty,
        result.lazyMode,
        result.wpm,
        result.acc,
        result.rawWpm,
        result.consistency,
      );
    });

    return { tagPbs: response.body.data.tagPbs };
  }

  const persisted: UpdateTagsResult = { tagPbs: [] };
  const transaction = actionsByClient[params.client ?? "web"].updateTags({
    ...params,
    persisted,
  });
  await transaction.isPersisted.promise;
  return persisted;
}

export async function insertLocalResult(
  params: ActionType["insertLocalResult"],
): Promise<void> {
  const client = params.result.client ?? "web";
  if (!resultsByClient[client]().isReady()) {
    //not loaded yet, don't need to insert
    return;
  }
  const transaction = actionsByClient[client].insertLocalResult(params);
  await transaction.isPersisted.promise;
}

export async function deleteLocalTag(
  params: ActionType["deleteLocalTag"],
): Promise<void> {
  for (const client of ["web", "tui"] as const) {
    if (!resultsByClient[client]().isReady()) continue;
    const transaction = actionsByClient[client].deleteLocalTag(params);
    await transaction.isPersisted.promise;
  }
}
