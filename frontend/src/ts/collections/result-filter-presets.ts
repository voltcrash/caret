import { operation } from "../../data/operations";
import { ResultFilters } from "@oxytype/schemas/users";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import {
  createCollection,
  createOptimisticAction,
  useLiveQuery,
} from "@tanstack/solid-db";
import { getQueryClient } from "../queries";
import { defineCollection } from "./utils/scope";
import { baseKey } from "../queries/utils/keys";
import {
  replaceSpacesWithUnderscores,
  replaceUnderscoresWithSpaces,
} from "../utils/strings";
import { applyIdWorkaround, tempId } from "./utils/misc";
import { loadAccountData } from "../queries/account";
import { isAuthenticated } from "../states/core";

const queryKeys = {
  root: () => [...baseKey("resultFilterPresets", { isUserSpecific: true })],
};

const resultFilterPresetsCollection = defineCollection(import.meta.hot, () =>
  createCollection(
    queryCollectionOptions({
      staleTime: Infinity,
      startSync: true,
      queryKey: queryKeys.root(),
      queryClient: getQueryClient(),
      enabled: isAuthenticated,
      getKey: (it) => it._id,
      queryFn: async () => {
        const userData = await loadAccountData();
        if (userData === undefined) return [];

        return (userData.resultFilterPresets ?? [])
          .map((it) => ({
            ...it,
            name: replaceUnderscoresWithSpaces(it.name),
          }))
          .map(applyIdWorkaround);
      },
    }),
  ),
);

export function useResultFilterPresetsLiveQuery() {
  return useLiveQuery((q) => {
    if (!isAuthenticated()) return undefined;
    return q.from({ presets: resultFilterPresetsCollection() });
  });
}

type ActionType = {
  insertResultFilterPreset: {
    name: string;
    filters: ResultFilters;
  };
  deleteResultFilterPreset: {
    presetId: string;
  };
};

const actions = {
  insertResultFilterPreset: createOptimisticAction<
    ActionType["insertResultFilterPreset"]
  >({
    onMutate: ({ name, filters }) => {
      resultFilterPresetsCollection().insert({
        ...structuredClone(filters),
        _id: tempId(),
        name,
      });
    },
    mutationFn: async ({ name, filters }) => {
      const response = await operation("users.addResultFilterPreset", {
        body: {
          ...structuredClone(filters),
          name: replaceSpacesWithUnderscores(name),
        },
      });
      if (!response.ok) {
        throw new Error(
          `Failed to insert result filter presets: ${response.message}`,
        );
      }

      const newPreset: ResultFilters = {
        ...structuredClone(filters),
        _id: response.data,
        name,
      };

      resultFilterPresetsCollection().utils.writeInsert(newPreset);
    },
  }),
  deleteResultFilterPreset: createOptimisticAction<
    ActionType["deleteResultFilterPreset"]
  >({
    onMutate: ({ presetId }) => {
      resultFilterPresetsCollection().delete(presetId);
    },
    mutationFn: async ({ presetId }) => {
      const response = await operation("users.removeResultFilterPreset", {
        params: { presetId },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to delete result filter presets: ${response.message}`,
        );
      }

      resultFilterPresetsCollection().utils.writeDelete(presetId);
    },
  }),
};

export async function insertResultFilterPreset(
  params: ActionType["insertResultFilterPreset"],
): Promise<void> {
  const transaction = actions.insertResultFilterPreset(params);
  await transaction.isPersisted.promise;
}

export async function deleteResultFilterPreset(
  params: ActionType["deleteResultFilterPreset"],
): Promise<void> {
  const transaction = actions.deleteResultFilterPreset(params);
  await transaction.isPersisted.promise;
}
