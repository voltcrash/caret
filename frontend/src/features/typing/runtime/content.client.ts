import { languageHashes } from "virtual:language-hashes";
import {
  initialTypingState,
  initialContentKey,
  saveTypingPreview,
} from "../initial-snapshot.client";
import { createAppOwned } from "../../../app/application";
import { getBrowserEngine } from "../engine.client";
import { getEngineSession } from "./session.client";
import { captureTypingRoute } from "../scope";
import { projectEngineConfig } from "@caret/typing-engine/config";
import { EngineFailure } from "@caret/typing-engine/failure";
import { decodeText, encodeText } from "@caret/typing-engine/text";
import type {
  ContentRequest,
  Prepare,
  Quote,
  Random,
  Source,
} from "@caret/typing-engine/browser.client";
import {
  LanguageSchema,
  type LanguageObject,
  type Language,
} from "@caret/schemas/languages";
import { QuoteDataSchema } from "@caret/schemas/quotes";
import { getMutableConfig } from "../../../ts/config/store";
import { cachedFetchJson, getLanguage } from "../../../ts/utils/json-data";
import { removeLanguageSize } from "../../../ts/utils/strings";
import {
  getSelectedQuoteId,
  isRepeated,
  setCurrentQuote,
  getCurrentQuote,
} from "../../../ts/states/test";
import { showNoticeNotification } from "../../../ts/states/notifications";
import { getSnapshot } from "../../../ts/db";
import * as CustomText from "./custom-text";
import {
  engineLanguage,
  engineQuotes,
  fetchEngineSource,
} from "./content-assets.client";

function random(): Random {
  return {
    kind: "seeded",
    state: crypto.getRandomValues(new Uint32Array(1))[0] as number,
  };
}
function webQuote(
  quote: Quote,
): NonNullable<ReturnType<typeof getCurrentQuote>> {
  return {
    ...quote,
    text: decodeText(quote.text),
    ...(quote.britishText === undefined
      ? { britishText: undefined }
      : { britishText: decodeText(quote.britishText) }),
    textSplit: quote.textSplit.map(decodeText),
    language: LanguageSchema.parse(quote.language),
  };
}
/** Host I/O, account selectors and cancellation. Rust selects/transforms all content. */
export const getContentHost = createAppOwned(() => {
  const owner = getBrowserEngine();
  let activeRequest:
    | {
        key: string;
        lease: ReturnType<typeof owner.captureSession>;
        promise: Promise<void>;
      }
    | undefined;
  let cachedQuotes:
    | { name: string; asset: NonNullable<Prepare["quotes"]> }
    | undefined;
  const rawQuotes = async (
    name: string,
    signal?: AbortSignal,
  ): Promise<NonNullable<Prepare["quotes"]>> => {
    if (cachedQuotes?.name === name) {
      return cachedQuotes.asset;
    }
    const empty = { language: name, groups: [], quotes: [] };
    try {
      const asset = await cachedFetchJson<unknown>(`quotes/${name}.json`);
      signal?.throwIfAborted();
      if (
        asset !== null &&
        typeof asset === "object" &&
        "quotes" in asset &&
        Array.isArray(asset.quotes) &&
        asset.quotes.length !== 0
      ) {
        const converted = engineQuotes(QuoteDataSchema.parse(asset));
        cachedQuotes = { name, asset: converted };
        return converted;
      }
      return empty;
    } catch (error) {
      signal?.throwIfAborted();
      if (
        !(error instanceof Error) ||
        (!error.message.includes("404") &&
          !error.message.includes("Content is not JSON"))
      ) {
        throw error;
      }
      return empty;
    }
  };
  const supply = async (
    request: ContentRequest,
    lease: ReturnType<typeof owner.captureSession>,
    accept: (source: Source) => void,
    reject: () => never,
  ): Promise<void> => {
    for (;;) {
      lease.signal.throwIfAborted();
      let source: Source;
      try {
        const language = await getLanguage(
          LanguageSchema.parse(request.language),
        );
        lease.signal.throwIfAborted();
        source = await fetchEngineSource(request, language, lease.signal);
      } catch {
        lease.signal.throwIfAborted();
        if (!lease.isCurrent()) {
          throw new DOMException("Stale content request", "AbortError");
        }
        reject();
      }
      lease.signal.throwIfAborted();
      if (!lease.isCurrent()) {
        throw new DOMException("Stale content request", "AbortError");
      }
      try {
        accept(source);
        return;
      } catch (error) {
        // The original Wikipedia adapter fetches another article after empty cleanup.
        if (
          request.kind === "wikipedia" &&
          error instanceof EngineFailure &&
          error.code === "emptyContent"
        ) {
          continue;
        }
        if (
          error instanceof EngineFailure &&
          ["invalidInput", "invalidContent", "emptyContent"].includes(
            error.code,
          )
        ) {
          reject();
        }
        throw error;
      }
    }
  };
  return {
    getQuotes: async (language: Language, lengths?: number[]) => {
      await owner.load();
      const asset = await rawQuotes(removeLanguageSize(language));
      const collection = owner
        .content()
        .quoteCatalog(asset, lengths ?? null, random());
      const quotes = collection.quotes.map(webQuote);
      return {
        ...collection,
        quotes,
        groups: collection.groups.map((group) =>
          group.map((index) => {
            const quote = quotes[index];
            if (quote === undefined) {
              throw new Error("Invalid native quote catalog index");
            }
            return quote;
          }),
        ),
      };
    },
    quoteLengthsChanged: (lengths: number[]): void => {
      if (owner.status().state === "ready") {
        owner.content().updateQuoteQueue(lengths, random());
      }
    },
    prepare: async (language: LanguageObject) => {
      const route = captureTypingRoute();
      await owner.load();
      if (!route.isCurrent()) {
        throw new DOMException("Typing route left", "AbortError");
      }
      const content = owner.beginReplacement();
      const lease = owner.captureSession();
      setCurrentQuote(null);
      const config = projectEngineConfig(getMutableConfig());
      const repeated = isRepeated();
      const engineHash = initialTypingState().engineHash();
      const contentKey =
        engineHash === ""
          ? ""
          : await initialContentKey(
              getMutableConfig(),
              languageHashes[language.name] ?? "",
              engineHash,
            );
      lease.signal.throwIfAborted();
      const seed =
        (!repeated ? initialTypingState().seed(contentKey) : undefined) ??
        crypto.getRandomValues(new Uint32Array(1))[0] ??
        0;
      let quotes: Prepare["quotes"] = null;
      if (config.mode === "quote" && !repeated) {
        const name = language.name.startsWith("swiss_german")
          ? "german"
          : removeLanguageSize(language.name);
        quotes = await rawQuotes(name, lease.signal);
      }
      const polyglot = config.funbox.includes("polyglot")
        ? (
            await Promise.all(
              config.customPolyglot.map(async (name) => {
                try {
                  return engineLanguage(
                    await getLanguage(LanguageSchema.parse(name)),
                  );
                } catch {
                  lease.signal.throwIfAborted();
                  showNoticeNotification(
                    `Failed to load language: ${name}. It will be ignored.`,
                  );
                  return null;
                }
              }),
            )
          ).filter((item): item is Prepare["language"] => item !== null)
        : [];
      lease.signal.throwIfAborted();
      if (!route.isCurrent() || !lease.isCurrent()) {
        throw new DOMException("Stale content preparation", "AbortError");
      }
      const favorites = getSnapshot()?.favoriteQuotes ?? {};
      const favoriteQuoteIds = Object.entries(favorites)
        .filter(
          ([name]) =>
            removeLanguageSize(LanguageSchema.parse(name)) ===
            removeLanguageSize(getMutableConfig().language),
        )
        .flatMap(([, ids]) => ids ?? [])
        .map((id) => Number.parseInt(id, 10));
      const custom = CustomText.getData();
      content.prepare(
        {
          config,
          language: engineLanguage(language),
          random: { kind: "seeded", state: seed },
          quotes,
          polyglot,
          selectedQuoteId: getSelectedQuoteId(),
          favoriteQuoteIds,
          sections: [],
          custom:
            config.mode === "custom"
              ? { ...custom, text: custom.text.map(encodeText) }
              : null,
        },
        repeated,
      );
      let generated: ReturnType<typeof content.generate>;
      for (;;) {
        try {
          generated = content.generate(repeated);
          break;
        } catch (error) {
          if (
            !(error instanceof EngineFailure) ||
            error.code !== "contentRequired"
          ) {
            throw error;
          }
          const request = content.request();
          if (request === null) throw error;
          await supply(
            request,
            lease,
            (source) => content.supply(request, source),
            () => content.failSource(request),
          );
        }
      }
      lease.signal.throwIfAborted();
      if (!route.isCurrent() || !lease.isCurrent()) {
        throw new DOMException("Stale generated content", "AbortError");
      }
      const metadata = content.metadata();
      setCurrentQuote(
        metadata.currentQuote === null ? null : webQuote(metadata.currentQuote),
      );
      owner.createPreparedSession(repeated);
      const snapshot = getEngineSession().attach();
      if (engineHash !== "" && !repeated && snapshot.words.length > 0) {
        saveTypingPreview(
          getMutableConfig(),
          seed,
          contentKey,
          snapshot.words.map(decodeText),
        );
      }
      return {
        ...generated,
        words: snapshot.words.map(decodeText),
        sectionIndexes: snapshot.sectionIndexes,
        allRightToLeft: generated.allRightToLeft ?? undefined,
        allJoiningScript: generated.allJoiningScript,
      };
    },
    // oxlint-disable-next-line typescript/promise-function-async -- Share one in-flight source operation for the exact native token.
    supplyActive: (request: ContentRequest): Promise<void> => {
      const key = JSON.stringify(request);
      if (activeRequest?.key === key && activeRequest.lease.isCurrent()) {
        return activeRequest.promise;
      }
      const lease = owner.captureSession();
      const session = getEngineSession();
      const promise: Promise<void> = supply(
        request,
        lease,
        (source) => {
          session.command({
            op: "supplyContent",
            now: performance.now(),
            date: Date.now(),
            request,
            source,
          });
        },
        () => {
          session.command({
            op: "failContent",
            now: performance.now(),
            request,
          });
          throw new Error("Expected source failure");
        },
      ).finally(() => {
        if (activeRequest?.promise === promise) activeRequest = undefined;
      });
      activeRequest = { key, lease, promise };
      return promise;
    },
  };
});
