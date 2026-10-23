import { Language, LanguageObject } from "@oxytype/schemas/languages";
import { LayoutObject } from "@oxytype/schemas/layouts";
import { languageHashes } from "virtual:language-hashes";
import { isDevEnvironment } from "./env";
import { toHex } from "./strings";
import {
  createLanguageLoader,
  memoizeAsync,
} from "@oxytype/web-shared/languages";

//pin implementation
const fetch = window.fetch;
const cryptoSubtle = window.crypto.subtle;

/**
 * Fetches JSON data from the specified URL using the fetch API.
 * @param url - The URL to fetch the JSON data from.
 * @returns A promise that resolves to the parsed JSON data.
 * @throws {Error} If the URL is not provided or if the fetch request fails.
 */
async function fetchJson<T>(url: string): Promise<T> {
  try {
    if (!url) throw new Error("No URL");
    const res = await fetch(url);
    if (res.ok) {
      if (!res.headers.get("content-type")?.startsWith("application/json")) {
        throw new Error("Content is not JSON");
      }
      return (await res.json()) as T;
    } else {
      throw new Error(`${res.status} ${res.statusText}`);
    }
  } catch (e) {
    console.error(`Error fetching JSON: ${url}`, e);
    throw e;
  }
}

/**
 * Memoizes the fetchJson function to cache the results of fetch requests.
 * @param url - The URL used to fetch JSON data.
 * @returns A promise that resolves to the cached JSON data.
 */
export const cachedFetchJson = memoizeAsync(fetchJson, undefined, {
  maxEntries: 16,
});

/**
 * Fetches a layout by name from the server.
 * @param layoutName The name of the layout to fetch.
 * @returns A promise that resolves to the layout object.
 * @throws {Error} If the layout list or layout doesn't exist.
 */
export async function getLayout(layoutName: string): Promise<LayoutObject> {
  return await cachedFetchJson<LayoutObject>(`/layouts/${layoutName}.json`);
}

/**
 * Content-addressed in production so the service worker can serve repeat
 * visits from cache without a network round trip.
 */
export function getLanguageUrl(lang: Language): string {
  const hash = languageHashes[lang] as string | undefined;
  const url = `/languages/${lang}.json`;
  return hash === undefined ? url : `${url}?v=${hash.slice(0, 16)}`;
}

const languageLoader = createLanguageLoader({
  maxEntries: 8,
  fetchJson,
  getUrl: getLanguageUrl,
  verify: async (lang, loaded) => {
    if (isDevEnvironment()) return;
    //check the content to make it less easy to manipulate
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(loaded, null, 0));
    const hashBuffer = await cryptoSubtle.digest("SHA-256", data);
    const hash = toHex(hashBuffer);
    if (hash !== languageHashes[lang]) {
      throw new Error(
        "Integrity check failed. Try refreshing the page. If this error persists, please contact support.",
      );
    }
  },
});

/**
 * Fetches the language object for a given language from the server.
 * @param lang The language code.
 * @returns A promise that resolves to the language object.
 */
export const getLanguage = languageLoader.getLanguage;

export const checkIfLanguageSupportsZipf =
  languageLoader.checkIfLanguageSupportsZipf;

/**
 * Fetches the current language object.
 * @param languageName The name of the language.
 * @returns A promise that resolves to the current language object.
 */
export async function getCurrentLanguage(
  languageName: Language,
): Promise<LanguageObject> {
  return await getLanguage(languageName);
}
