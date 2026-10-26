import { Language, LanguageObject } from "@caret/schemas/languages";

/**
 * Fetches and parses JSON. Each client brings its own (browser fetch, cached
 * files on disk, bundled assets).
 */
export type FetchJson = (url: string) => Promise<unknown>;

export type AsyncCacheOptions = {
  /** Maximum retained entries, evicting the least recently used first. */
  maxEntries?: number;
};

/**
 * Memoizes an asynchronous function.
 * @template Args Function argument tuple
 * @template R   Resolved value of the Promise
 * @param fn The async function to memoize.
 * @param getKey Optional function to compute a cache key from the function arguments. If omitted, the first argument is used as the key.
 * @returns A memoized version of the async function with the same signature.
 */
export function memoizeAsync<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
  getKey?: (...args: Args) => unknown,
  options: AsyncCacheOptions = {},
): (...args: Args) => Promise<R> {
  const cache = new Map<unknown, Promise<R>>();
  const maxEntries = options.maxEntries ?? Infinity;
  if (
    maxEntries !== Infinity &&
    (!Number.isInteger(maxEntries) || maxEntries < 1)
  ) {
    throw new Error("maxEntries must be a positive integer or Infinity");
  }

  return async (...args: Args): Promise<R> => {
    const key = getKey ? getKey(...args) : args[0];

    const cached = cache.get(key);
    if (cached !== undefined) {
      cache.delete(key);
      cache.set(key, cached);
      return cached;
    }

    const result = fn(...args).catch((error: unknown) => {
      if (cache.get(key) === result) cache.delete(key);
      throw error;
    });
    cache.set(key, result);
    if (cache.size > maxEntries) {
      cache.delete(cache.keys().next().value);
    }
    return result;
  };
}

export type LanguageLoaderOptions = AsyncCacheOptions & {
  fetchJson: FetchJson;
  /** Where to load a language from. Defaults to `/languages/<name>.json`. */
  getUrl?: (language: Language) => string;
  /** Throws if the loaded language must not be used (integrity checks). */
  verify?: (language: Language, loaded: LanguageObject) => Promise<void>;
};

export type LanguageLoader = {
  getLanguage: (language: Language) => Promise<LanguageObject>;
  checkIfLanguageSupportsZipf: (
    language: Language,
  ) => Promise<"yes" | "no" | "unknown">;
};

export function createLanguageLoader(
  options: LanguageLoaderOptions,
): LanguageLoader {
  const getUrl =
    options.getUrl ?? ((language: Language) => `/languages/${language}.json`);

  const cachedFetchLanguage = memoizeAsync(
    async (language: Language): Promise<LanguageObject> => {
      const loaded = (await options.fetchJson(
        getUrl(language),
      )) as LanguageObject;
      await options.verify?.(language, loaded);
      return loaded;
    },
    undefined,
    { maxEntries: options.maxEntries },
  );

  let currentLanguage: LanguageObject | undefined;

  async function getLanguage(language: Language): Promise<LanguageObject> {
    if (currentLanguage === undefined || currentLanguage.name !== language) {
      currentLanguage = await cachedFetchLanguage(language);
    }
    return currentLanguage;
  }

  async function checkIfLanguageSupportsZipf(
    language: Language,
  ): Promise<"yes" | "no" | "unknown"> {
    const lang = await getLanguage(language);
    if (lang.orderedByFrequency === true) return "yes";
    if (lang.orderedByFrequency === false) return "no";
    return "unknown";
  }

  return { getLanguage, checkIfLanguageSupportsZipf };
}
