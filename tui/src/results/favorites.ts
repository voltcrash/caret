import { z } from "zod";
import {
  FavoriteQuotesSchema,
  type FavoriteQuotes,
} from "@oxytype/schemas/users";
import type { Language } from "@oxytype/schemas/languages";
import { createSignal } from "solid-js";
import type { Api } from "../api/client";
import { readJson, writeJson } from "../storage/json";
import { dataOrThrow } from "../ui/remote";
import { requireSuccess } from "../ui/actions";

export type QuoteFavorites = {
  get: () => FavoriteQuotes;
  reload: () => Promise<void>;
  toggle: (language: Language, quoteId: number) => Promise<void>;
  flush: () => Promise<void>;
};
export async function openQuoteFavorites(
  file: string,
  api: Api,
  owner: () => string | undefined,
): Promise<QuoteFavorites> {
  const stored = await readJson(
    file,
    z.record(z.string(), FavoriteQuotesSchema),
  );
  const [records, setRecords] = createSignal<Record<string, FavoriteQuotes>>(
    stored.status === "ok" ? stored.value : {},
  );
  let pending = Promise.resolve();
  const get = (): FavoriteQuotes => {
    const key = owner();
    return key === undefined ? {} : (records()[key] ?? {});
  };
  const save = (key: string, value: FavoriteQuotes): void => {
    const snapshot = { ...records(), [key]: value };
    setRecords(snapshot);
    const write = async (): Promise<void> => writeJson(file, snapshot);
    pending = pending.then(write, write);
    void pending.catch(() => undefined);
  };
  const reload = async (): Promise<void> => {
    const key = owner();
    if (key === undefined) return;
    const favorites = dataOrThrow(await api.client.users.getFavoriteQuotes());
    if (key === owner()) save(key, favorites);
  };
  return {
    get,
    reload,
    flush: async () => pending,
    toggle: async (language, quoteId) => {
      const key = owner();
      if (key === undefined) throw new Error("Log in to favorite quotes");
      const id = String(quoteId);
      const ids = get()[language] ?? [];
      const remove = ids.includes(id);
      const body = { language, quoteId: id };
      requireSuccess(
        await (remove
          ? api.client.users.removeQuoteFromFavorites({ body })
          : api.client.users.addQuoteToFavorites({ body })),
      );
      if (key === owner()) {
        save(key, {
          ...get(),
          [language]: remove ? ids.filter((it) => it !== id) : [...ids, id],
        });
      }
    },
  };
}
