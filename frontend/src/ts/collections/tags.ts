import { operation } from "../../data/operations";
import { UserTag } from "@oxytype/schemas/users";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import {
  createCollection,
  createOptimisticAction,
  eq,
  queryOnce,
  useLiveQuery,
} from "@tanstack/solid-db";
import { untrack } from "solid-js";
import { z } from "zod";
import { getQueryClient } from "../queries";
import { defineCollection } from "./utils/scope";
import { baseKey } from "../queries/utils/keys";
import { LocalStorageWithSchema } from "../utils/local-storage-with-schema";
import { IdSchema } from "@oxytype/schemas/util";
import { SnapshotResult } from "../constants/default-snapshot";
import { Mode, Mode2, PersonalBest } from "@oxytype/schemas/shared";
import { Difficulty } from "@oxytype/schemas/configs";
import { Language } from "@oxytype/schemas/languages";
import { applyIdWorkaround, isTempId, tempId } from "./utils/misc";
import { createCollectionReader } from "./utils/reader";
import { loadAccountData } from "../queries/account";
import { updateTagsInFilterStorage } from "../states/result-filters";
import { isAuthenticated } from "../states/core";
import { emptyPersonalBests, personalBestList } from "../utils/personal-bests";

export type TagItem = UserTag & { active: boolean };

const queryKeys = {
  root: () => [...baseKey("tags", { isUserSpecific: true })],
};

const tagsCollection = defineCollection(import.meta.hot, () =>
  createCollection(
    queryCollectionOptions({
      staleTime: Infinity,
      queryKey: queryKeys.root(),
      queryClient: getQueryClient(),
      enabled: isAuthenticated,
      getKey: (it) => it._id,
      queryFn: async () => {
        const activeIds = activeTagsLS.get();
        const userData = await loadAccountData();

        if (userData === undefined) return [];

        const results = (userData.tags ?? [])
          .map((tag) => ({
            ...tag,
            name: tag.name.replace(/_/g, " "),
            active: activeIds.includes(tag._id),
          }))
          .map(applyIdWorkaround);

        updateTagsInFilterStorage(results.map((it) => it._id) ?? []);
        return results;
      },
    }),
  ),
);

const tagsReader = createCollectionReader(tagsCollection);

export function useTagsLiveQuery() {
  return useLiveQuery((q) => {
    if (!isAuthenticated()) return undefined;
    return q
      .from({ tag: tagsCollection() })
      .orderBy(({ tag }) => tag.name, "asc");
  });
}

export async function getActiveTagsOnce() {
  return queryOnce((q) => {
    return q
      .from({ tag: tagsCollection() })
      .where(({ tag }) => eq(tag.active, true))
      .orderBy(({ tag }) => tag.name, "asc");
  });
}

export async function getTagsOnce() {
  return queryOnce((q) => {
    return q.from({ tag: tagsCollection() });
  });
}

export function useActiveTagsLiveQuery() {
  return useLiveQuery((q) => {
    if (!isAuthenticated()) return undefined;
    return q
      .from({ tag: tagsCollection() })
      .where(({ tag }) => eq(tag.active, true))
      .orderBy(({ tag }) => tag.name, "asc");
  });
}

type ActionType = {
  insertTag: {
    name: string;
  };
  updateTagName: {
    tagId: string;
    newName: string;
  };
  clearTagPBs: {
    tagId: string;
  };
  deleteTag: {
    tagId: string;
  };
  toggleTagActive: {
    tagId: string;
    noSave?: boolean;
  };
  setTagActive: {
    tagId: string;
    active: boolean;
    noSave?: boolean;
  };
  clearActiveTags: {
    noSave?: boolean;
  };
};

const actions = {
  insertTag: createOptimisticAction<ActionType["insertTag"]>({
    onMutate: ({ name }) => {
      tagsCollection().insert({
        _id: tempId(),
        name: name.replace(/_/g, " "),
        personalBests: { time: {}, words: {}, quote: {}, zen: {}, custom: {} },
        active: false,
      });
    },
    mutationFn: async ({ name }) => {
      const response = await operation("users.createTag", {
        body: { tagName: name.replace(/ /g, "_") },
      });
      if (!response.ok) {
        throw new Error(`Failed to add tag: ${response.message}`);
      }
      const newTag = {
        ...response.data,
        name: response.data.name.replace(/_/g, " "),
        active: false,
      };

      tagsCollection().utils.writeInsert(newTag);
      updateTagsInFilterStorage(
        [...tagsCollection().values()]
          .filter((it) => !isTempId(it._id))
          .map((it) => it._id),
      );
    },
  }),
  updateTagName: createOptimisticAction<ActionType["updateTagName"]>({
    onMutate: ({ tagId, newName }) => {
      tagsCollection().update(tagId, (tag) => {
        tag.name = newName.replace(/_/g, " ");
      });
    },
    mutationFn: async ({ tagId, newName }) => {
      const response = await operation("users.editTag", {
        body: { tagId, newName: newName.replace(/ /g, "_") },
      });
      if (!response.ok) {
        throw new Error(`Failed to update tag: ${response.message}`);
      }

      tagsCollection().utils.writeUpdate({
        _id: tagId,
        name: newName.replace(/_/g, " "),
      });
    },
  }),
  clearTagPBs: createOptimisticAction<ActionType["clearTagPBs"]>({
    onMutate: ({ tagId }) => {
      tagsCollection().update(tagId, (tag) => {
        tag.personalBests = {
          time: {},
          words: {},
          quote: {},
          zen: {},
          custom: {},
        };
      });
    },
    mutationFn: async ({ tagId }) => {
      const response = await operation("users.deleteTagPersonalBest", {
        params: { tagId },
      });
      if (!response.ok) {
        throw new Error(`Failed to clear tag PBs: ${response.message}`);
      }

      tagsCollection().utils.writeUpdate({
        _id: tagId,
        personalBests: {
          time: {},
          words: {},
          quote: {},
          zen: {},
          custom: {},
        },
      });
    },
  }),
  deleteTag: createOptimisticAction<ActionType["deleteTag"]>({
    onMutate: ({ tagId }) => {
      tagsCollection().delete(tagId);
    },
    mutationFn: async ({ tagId }) => {
      const response = await operation("users.deleteTag", {
        params: { tagId },
      });
      if (!response.ok) {
        throw new Error(`Failed to delete tag: ${response.message}`);
      }
      tagsCollection().utils.writeDelete(tagId);
      updateTagsInFilterStorage(
        [...tagsCollection().values()].map((it) => it._id),
      );
    },
  }),
  toggleTagActive: createOptimisticAction<ActionType["toggleTagActive"]>({
    onMutate: ({ tagId, noSave }) => {
      const tag = tagsCollection().get(tagId);
      if (tag === undefined) return;
      tagsCollection().utils.writeUpdate({ ...tag, active: !tag.active });
      if (!noSave) saveActiveToLocalStorage();
    },
    mutationFn: async () => {
      return;
    },
  }),
  setTagActive: createOptimisticAction<ActionType["setTagActive"]>({
    onMutate: ({ tagId, active, noSave }) => {
      const tag = tagsCollection().get(tagId);
      if (tag === undefined) return;
      tagsCollection().utils.writeUpdate({ ...tag, active });
      if (!noSave) saveActiveToLocalStorage();
    },
    mutationFn: async () => {
      return;
    },
  }),
  clearActiveTags: createOptimisticAction<ActionType["clearActiveTags"]>({
    onMutate: ({ noSave }) => {
      tagsCollection().utils.writeBatch(() => {
        tagsCollection().forEach((tag) => {
          if (tag.active) {
            tagsCollection().utils.writeUpdate({ ...tag, active: false });
          }
        });
      });
      if (!noSave) saveActiveToLocalStorage();
    },
    mutationFn: async () => {
      return;
    },
  }),
};

// --- Public API ---

export async function waitForTagsReady(): Promise<void> {
  await tagsCollection().stateWhenReady();
}

export async function insertTag(
  params: ActionType["insertTag"],
): Promise<void> {
  const transaction = actions.insertTag(params);
  await transaction.isPersisted.promise;
}

export async function updateTagName(
  params: ActionType["updateTagName"],
): Promise<void> {
  const transaction = actions.updateTagName(params);
  await transaction.isPersisted.promise;
}

export async function clearTagPBs(
  params: ActionType["clearTagPBs"],
): Promise<void> {
  const transaction = actions.clearTagPBs(params);
  await transaction.isPersisted.promise;
}

export async function deleteTag(
  params: ActionType["deleteTag"],
): Promise<void> {
  const transaction = actions.deleteTag(params);
  await transaction.isPersisted.promise;
}

export async function toggleTagActive(
  params: ActionType["toggleTagActive"],
): Promise<void> {
  const transaction = actions.toggleTagActive(params);
  await transaction.isPersisted.promise;
}

export async function setTagActive(
  params: ActionType["setTagActive"],
): Promise<void> {
  const transaction = actions.setTagActive(params);
  await transaction.isPersisted.promise;
}

export async function clearActiveTags(
  params: ActionType["clearActiveTags"] = {},
): Promise<void> {
  const transaction = actions.clearActiveTags(params);
  await transaction.isPersisted.promise;
}

/** Reactive. Sorted by name. */
export function getTags(): TagItem[] {
  return tagsReader.values().sort((a, b) => a.name.localeCompare(b.name));
}

/** Reactive. */
export function getTag(id: string): TagItem | undefined {
  return tagsReader.get(id);
}

/** Reactive. Sorted by name. */
export function getActiveTags(): TagItem[] {
  return getTags().filter((tag) => tag.active);
}

// --- Active state ---

const activeTagsLS = new LocalStorageWithSchema({
  key: "activeTags",
  schema: z.array(IdSchema),
  fallback: [],
});

export function saveActiveToLocalStorage(): void {
  const activeIds: string[] = [];
  tagsCollection().forEach((t) => {
    if (t.active) activeIds.push(t._id);
  });
  activeTagsLS.set(activeIds);
}

// --- Personal bests ---

export function getLocalTagPB<M extends Mode>(
  tagId: string,
  mode: M,
  mode2: Mode2<M>,
  punctuation: boolean,
  numbers: boolean,
  language: string,
  difficulty: Difficulty,
  lazyMode: boolean,
): number {
  const tag = tagsCollection().get(tagId);
  if (tag === undefined) return 0;

  const personalBests = (tag.personalBests?.[mode]?.[mode2] ??
    []) as PersonalBest[];

  return (
    personalBests.find(
      (pb) =>
        (pb.punctuation ?? false) === punctuation &&
        (pb.numbers ?? false) === numbers &&
        pb.difficulty === difficulty &&
        pb.language === language &&
        (pb.lazyMode === lazyMode || (pb.lazyMode === undefined && !lazyMode)),
    )?.wpm ?? 0
  );
}

export function saveLocalTagPB<M extends Mode>(
  tagId: string,
  mode: M,
  mode2: Mode2<M>,
  punctuation: boolean,
  numbers: boolean,
  language: Language,
  difficulty: Difficulty,
  lazyMode: boolean,
  wpm: number,
  acc: number,
  raw: number,
  consistency: number,
): void {
  if (mode === "quote") return;

  const collectionTag = tagsCollection().get(tagId);
  if (collectionTag === undefined) return;
  const tag = structuredClone(collectionTag);

  const entry: PersonalBest = {
    language,
    difficulty,
    lazyMode,
    punctuation,
    numbers,
    wpm,
    acc,
    raw,
    timestamp: Date.now(),
    consistency,
  };
  tag.personalBests ??= emptyPersonalBests();

  try {
    const list = personalBestList(tag.personalBests, mode, mode2);
    const matching = list.filter(
      (pb) =>
        (pb.punctuation ?? false) === punctuation &&
        (pb.numbers ?? false) === numbers &&
        pb.difficulty === difficulty &&
        pb.language === language &&
        (pb.lazyMode === lazyMode || (pb.lazyMode === undefined && !lazyMode)),
    );
    for (const pb of matching) {
      Object.assign(pb, {
        wpm,
        acc,
        raw,
        timestamp: Date.now(),
        consistency,
        lazyMode,
      });
    }
    if (matching.length === 0) list.push(entry);
  } catch {
    tag.personalBests = emptyPersonalBests();
    personalBestList(tag.personalBests, mode, mode2).push(entry);
  }

  // using utils.writeUpdate instead of collection.update because we dont need to send this to the API
  // the result saving already updates the tag pb in the db
  tagsCollection().utils.writeUpdate(tag);
}

export function reconcileLocalTagPB<M extends Mode>(
  tagId: string,
  mode: M,
  mode2: Mode2<M>,
  punctuation: boolean,
  numbers: boolean,
  language: Language,
  difficulty: Difficulty,
  lazyMode: boolean,
  results: SnapshotResult<Mode>[],
): void {
  const tag = tagsCollection().get(tagId);
  if (tag === undefined) return;

  const pb = {
    wpm: 0,
    acc: 0,
    rawWpm: 0,
    consistency: 0,
  };

  results.forEach((result) => {
    if (result.tags.includes(tagId) && result.wpm > pb.wpm) {
      if (
        result.mode === mode &&
        result.mode2 === mode2 &&
        result.punctuation === punctuation &&
        result.numbers === numbers &&
        result.language === language &&
        result.difficulty === difficulty &&
        result.lazyMode === lazyMode
      ) {
        pb.wpm = result.wpm;
        pb.acc = result.acc;
        pb.rawWpm = result.rawWpm;
        pb.consistency = result.consistency;
      }
    }
  });

  saveLocalTagPB(
    tagId,
    mode,
    mode2,
    punctuation,
    numbers,
    language,
    difficulty,
    lazyMode,
    pb.wpm,
    pb.acc,
    pb.rawWpm,
    pb.consistency,
  );
}

export function getActiveTagsPB<M extends Mode>(
  mode: M,
  mode2: Mode2<M>,
  punctuation: boolean,
  numbers: boolean,
  language: string,
  difficulty: Difficulty,
  lazyMode: boolean,
): number {
  let tagPbWpm = 0;
  for (const tag of untrack(getActiveTags)) {
    const currTagPB = getLocalTagPB(
      tag._id,
      mode,
      mode2,
      punctuation,
      numbers,
      language,
      difficulty,
      lazyMode,
    );
    if (currTagPB > tagPbWpm) tagPbWpm = currTagPB;
  }
  return tagPbWpm;
}
