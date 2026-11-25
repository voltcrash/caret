import { createForm } from "@tanstack/solid-form";
import {
  untrack,
  JSXElement,
  createSignal,
  createEffect,
  For,
  Show,
  on,
} from "solid-js";
import { z } from "zod";

import { setSelectedQuoteId } from "#features/typing/state/quote-selection.ts";
import { AnimatedModal } from "#shared/components/common/AnimatedModal.tsx";
import { Button } from "#shared/components/common/Button.tsx";
import { HighlightedText } from "#shared/components/common/HighlightedText.tsx";
import { InputField } from "#shared/components/ui/form/InputField.tsx";
import Select from "#shared/components/ui/Select.tsx";
import { setConfig } from "#shared/config/setters.ts";
import { peekConfig } from "#shared/config/store.ts";
import * as DB from "#shared/db.ts";
import { createDebouncedEffectOn } from "#shared/hooks/effects.ts";
import { isAuthenticated } from "#shared/states/core.ts";
import { hideLoaderBar, showLoaderBar } from "#shared/states/loader-bar.ts";
import {
  hideModalAndClearChain,
  isModalOpen,
  showModal,
} from "#shared/states/modals.ts";
import {
  showNoticeNotification,
  showErrorNotification,
} from "#shared/states/notifications.ts";
import { showSimpleModal } from "#shared/states/simple-modal.ts";
import { cn } from "#shared/utils/cn.ts";
import { getLanguage } from "#shared/utils/json-data.ts";
import * as Misc from "#shared/utils/misc.ts";

import { getQueryClient } from "../../../data/queries";
import { getQuoteSubmissionEnabledQueryOptions } from "../../../data/queries/quotes";
import QuotesController, { Quote } from "../runtime/quotes-controller";
import * as TestLogic from "../runtime/test/logic";
import { showQuoteReportModal } from "../state/quote-report";
import { buildQuoteSearchIndex, QuoteSearchIndex } from "./quote-search";
import { QuoteApproveModal } from "./QuoteApproveModal";
import { QuoteSubmitModal } from "./QuoteSubmitModal";

const PAGE_SIZE = 100;

function exactSearch(quotes: Quote[], captured: RegExp[]): [Quote[], string[]] {
  const matches: Quote[] = [];
  const exactSearchQueryTerms: Set<string> = new Set<string>();

  for (const quote of quotes) {
    const textAndSource = quote.text + quote.source;
    const currentMatches: string[] = [];
    let noMatch = false;

    for (const regex of captured) {
      const match = textAndSource.match(regex);
      if (!match) {
        noMatch = true;
        break;
      }
      currentMatches.push(match[0]);
    }

    if (!noMatch) {
      currentMatches.forEach((m) => exactSearchQueryTerms.add(m));
      matches.push(quote);
    }
  }

  return [matches, Array.from(exactSearchQueryTerms)];
}

function getLengthDesc(quote: Quote): string {
  if (quote.length < 101) return "short";
  if (quote.length < 301) return "medium";
  if (quote.length < 601) return "long";
  return "thicc";
}

function Item(props: {
  quote: Quote;
  matchedTerms: string[];
  isRtl: boolean;
  onSelect: () => void;
  onReport: () => void;
  onToggleFavorite: () => Promise<boolean>;
}): JSXElement {
  const loggedOut = (): boolean => !isAuthenticated();
  const [isFav, setIsFav] = createSignal(
    untrack(
      () => !loggedOut() && QuotesController.isQuoteFavorite(props.quote),
    ),
  );

  const handleToggleFavorite = async (): Promise<void> => {
    setIsFav((v) => !v);
    const success = await props.onToggleFavorite();
    if (!success) {
      setIsFav((v) => !v);
    }
  };

  return (
    <div
      class="grid min-w-0 cursor-pointer gap-2 rounded p-4 transition-[background-color] duration-125 select-none [overflow-wrap:anywhere] hover:bg-sub-alt"
      onClick={() => props.onSelect()}
    >
      <div class="text-text [&_.highlight]:text-main" dir="auto">
        <HighlightedText text={props.quote.text} matches={props.matchedTerms} />
      </div>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_3fr]">
        <div class="text-xs text-sub">
          <div class="opacity-50">id</div>
          <span class="[&_.highlight]:text-main">
            <HighlightedText
              text={props.quote.id.toString()}
              matches={props.matchedTerms}
            />
          </span>
        </div>
        <div class="text-xs text-sub">
          <div class="opacity-50">length</div>
          {getLengthDesc(props.quote)}
        </div>
        <div class="col-span-2 flex min-w-0 sm:col-span-1">
          <div class="min-w-0 grow text-xs text-sub">
            <div class="opacity-50">source</div>
            <span class="[&_.highlight]:text-main">
              <HighlightedText
                text={props.quote.source}
                matches={props.matchedTerms}
              />
            </span>
          </div>
          <Show when={!loggedOut()}>
            <div class="flex shrink">
              <Button
                variant="text"
                class="min-h-9 min-w-9 sm:min-h-0 sm:min-w-0"
                fa={{ icon: "fa-flag" }}
                onClick={(e) => {
                  e.stopPropagation();
                  props.onReport();
                }}
                balloon={{
                  text: "Report quote",
                  position: props.isRtl ? "right" : "left",
                }}
              />
              <Button
                variant="text"
                class="min-h-9 min-w-9 sm:min-h-0 sm:min-w-0"
                fa={{
                  icon: "fa-heart",
                  variant: isFav() ? "solid" : "regular",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleToggleFavorite();
                }}
                balloon={{
                  text: "Favorite quote",
                  position: props.isRtl ? "right" : "left",
                }}
              />
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}

export function QuoteSearchModal(): JSXElement {
  const form = createForm(() => ({
    defaultValues: {
      searchText: "",
    },
  }));

  const [currentPage, setCurrentPage] = createSignal(1);
  const [lengthFilter, setLengthFilter] = createSignal<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = createSignal(false);
  const [customFilterMin, setCustomFilterMin] = createSignal(0);
  const [customFilterMax, setCustomFilterMax] = createSignal(0);
  const [hasCustomFilter, setHasCustomFilter] = createSignal(false);
  const [quotes, setQuotes] = createSignal<Quote[]>([]);
  const [searchResults, setSearchResults] = createSignal<{
    quotes: Quote[];
    exactTerms: string[];
    matchedTermsById: Map<number, string[]>;
  }>({ quotes: [], exactTerms: [], matchedTermsById: new Map() });
  const [isRtl, setIsRtl] = createSignal(false);
  const [favVersion, setFavVersion] = createSignal(0);

  let cachedQuotes: readonly Quote[] | undefined;
  let cachedSearchIndex: QuoteSearchIndex | undefined;

  const getSearchIndex = (allQuotes: readonly Quote[]): QuoteSearchIndex => {
    if (cachedQuotes === allQuotes && cachedSearchIndex !== undefined) {
      return cachedSearchIndex;
    }
    cachedQuotes = allQuotes;
    cachedSearchIndex = buildQuoteSearchIndex(allQuotes);
    return cachedSearchIndex;
  };

  const [searchText, setSearchText] = createSignal("");
  createDebouncedEffectOn(
    250,
    searchText,
    (text) => {
      setCurrentPage(1);
      performSearch(text);
    },
    { defer: true },
  );

  const isOpen = (): boolean => isModalOpen("QuoteSearch");

  const isQuoteMod = (): boolean => {
    const quoteMod = DB.getSnapshot()?.quoteMod;
    return (
      quoteMod !== undefined &&
      (quoteMod === true || (quoteMod as string) !== "")
    );
  };

  const performSearch = (text: string): void => {
    const allQuotes = quotes();
    if (allQuotes.length === 0) {
      setSearchResults({
        quotes: [],
        exactTerms: [],
        matchedTermsById: new Map(),
      });
      return;
    }

    if (text === "") {
      setSearchResults({
        quotes: allQuotes,
        exactTerms: [],
        matchedTermsById: new Map(),
      });
      return;
    }

    let matches: Quote[] = [];
    let exactSearchMatches: Quote[] = [];
    let exactSearchMatchedQueryTerms: string[] = [];
    let matchedTermsById = new Map<number, string[]>();

    const quotationsRegex = /"(.*?)"/g;
    const exactSearchQueries = Array.from(text.matchAll(quotationsRegex));
    const removedSearchText = text.replaceAll(quotationsRegex, "");

    if (exactSearchQueries[0]) {
      const searchQueriesRaw = exactSearchQueries.map(
        (query) => new RegExp(Misc.escapeRegExp(query[1] ?? ""), "i"),
      );
      [exactSearchMatches, exactSearchMatchedQueryTerms] = exactSearch(
        allQuotes,
        searchQueriesRaw,
      );
    }

    if (exactSearchMatches.length > 0 || removedSearchText === text) {
      const ids = exactSearchMatches.map((m) => m.id);
      if (removedSearchText.trim() !== "") {
        const quoteSearchIndex = getSearchIndex(allQuotes);
        ({ results: matches, matchedTermsById } = quoteSearchIndex.query(
          removedSearchText,
          ids,
        ));
      }
      if (exactSearchMatches.length > 0) {
        const seen = new Set(matches);
        for (const m of exactSearchMatches) {
          if (!seen.has(m)) matches.push(m);
        }
      }
    }

    setSearchResults({
      quotes: matches,
      exactTerms: exactSearchMatchedQueryTerms,
      matchedTermsById,
    });
  };

  const matchedTermsFor = (quoteId: number): string[] => {
    const { exactTerms, matchedTermsById } = searchResults();
    const indexedTerms = matchedTermsById.get(quoteId);
    if (indexedTerms === undefined) return exactTerms;
    if (exactTerms.length === 0) return indexedTerms;
    return [...exactTerms, ...indexedTerms];
  };

  const filteredQuotes = (): Quote[] => {
    favVersion();

    let result = searchResults().quotes;

    const lengths = lengthFilter();
    if (lengths.length > 0) {
      const groupFilter = new Set(
        lengths.filter((v) => v !== "4").map((v) => parseInt(v, 10)),
      );
      const hasCustom = lengths.includes("4");

      result = result.filter((quote) => {
        if (groupFilter.has(quote.group)) return true;
        if (
          hasCustom &&
          hasCustomFilter() &&
          quote.length >= customFilterMin() &&
          quote.length <= customFilterMax()
        ) {
          return true;
        }
        return false;
      });
    }

    if (showFavoritesOnly()) {
      result = result.filter((quote) =>
        QuotesController.isQuoteFavorite(quote),
      );
    }

    return result;
  };

  const totalPages = (): number =>
    Math.max(1, Math.ceil(filteredQuotes().length / PAGE_SIZE));

  const pageQuotes = (): Quote[] => {
    const start = (currentPage() - 1) * PAGE_SIZE;
    return filteredQuotes().slice(start, start + PAGE_SIZE);
  };

  const pageInfo = (): string => {
    const filtered = filteredQuotes();
    if (filtered.length === 0) return "No search results";
    const start = (currentPage() - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage() * PAGE_SIZE, filtered.length);
    return `${start} - ${end} of ${filtered.length}`;
  };

  createEffect(
    on(lengthFilter, (lengths) => {
      if (!lengths.includes("4")) {
        setHasCustomFilter(false);
      } else if (!hasCustomFilter()) {
        showSimpleModal({
          title: "Enter minimum and maximum number of words",
          buttonText: "save",
          schema: z.object({
            min: z.number().int().positive(),
            max: z.number().int().positive(),
          }),
          inputs: {
            min: { type: "number", placeholder: "1" },
            max: { type: "number", placeholder: "100" },
          },

          execFn: async ({ min, max }) => {
            setCustomFilterMin(min);
            setCustomFilterMax(max);
            setHasCustomFilter(true);
            return { status: "success", showNotification: false };
          },
        });
      }
    }),
  );

  const handleBeforeShow = (isChained: boolean): void => {
    if (isChained) return;
    form.reset();
    setSearchText("");
    setCurrentPage(1);
    setLengthFilter([]);
    setShowFavoritesOnly(false);
    setHasCustomFilter(false);
  };

  const handleAfterShow = async (): Promise<void> => {
    const quotesLanguage = await getLanguage(peekConfig().language);
    setIsRtl(quotesLanguage?.rightToLeft ?? false);
    const { quotes: fetchedQuotes } = await QuotesController.getQuotes(
      peekConfig().language,
    );
    setQuotes(fetchedQuotes);
    performSearch(form.state.values.searchText);
  };

  const applyQuote = (quoteId: number): void => {
    if (isNaN(quoteId) || quoteId < 0) {
      showNoticeNotification("Quote ID must be at least 1");
      return;
    }
    setSelectedQuoteId(quoteId);
    setConfig("quoteLength", [-2]);
    void TestLogic.restart();
    hideModalAndClearChain("QuoteSearch");
  };

  const toggleFavorite = async (quote: Quote): Promise<boolean> => {
    const alreadyFavorited = QuotesController.isQuoteFavorite(quote);

    try {
      showLoaderBar();
      await QuotesController.setQuoteFavorite(quote, !alreadyFavorited);
      hideLoaderBar();
      setFavVersion((v) => v + 1);
      return true;
    } catch (e) {
      hideLoaderBar();
      showErrorNotification(
        alreadyFavorited
          ? "Failed to remove quote from favorites"
          : "Failed to add quote to favorites",
        { error: e },
      );
      return false;
    }
  };

  const handleSubmitClick = async (): Promise<void> => {
    showLoaderBar();
    let isEnabled = false;
    try {
      isEnabled = (
        await getQueryClient().query(getQuoteSubmissionEnabledQueryOptions())
      ).isEnabled;
    } catch {
      // Preserve the disabled-submission notice on an unavailable service.
    } finally {
      hideLoaderBar();
    }
    if (!isEnabled) {
      showNoticeNotification(
        "Quote submission is disabled temporarily due to a large submission queue.",
        { durationMs: 5000 },
      );
      return;
    }
    showModal("QuoteSubmit");
  };

  return (
    <>
      <AnimatedModal
        id="QuoteSearch"
        focusFirstInput={true}
        beforeShow={handleBeforeShow}
        afterShow={handleAfterShow}
        modalClass="max-w-[1000px] h-[80vh] grid-rows-[auto_auto_1fr_auto]"
      >
        <div class="flex flex-col justify-between gap-2 sm:flex-row">
          <div class="text-2xl text-sub">Quote search</div>
          <div class="grid gap-2">
            <Show when={isAuthenticated()}>
              <Button
                fa={{ icon: "fa-plus" }}
                text="Submit a quote"
                onClick={() => void handleSubmitClick()}
              />
            </Show>
            <Show when={isQuoteMod()}>
              <Button
                fa={{ icon: "fa-check" }}
                text="Approve quotes"
                onClick={() => showModal("QuoteApprove")}
              />
            </Show>
          </div>
        </div>
        <div class="flex flex-col gap-4 sm:flex-row">
          <form.Field
            name="searchText"
            listeners={{
              onChange: ({ value }) => {
                if (!isOpen()) return;
                setSearchText(value);
              },
            }}
            children={(field) => (
              <InputField
                class="grow-3"
                field={field}
                placeholder="filter by text, source or id"
                autocomplete="off"
                dir="auto"
                maxLength={200}
              />
            )}
          />
          <div class="grow">
            <Select
              label="Quote length"
              multiple
              options={[
                { value: "0", text: "short" },
                { value: "1", text: "medium" },
                { value: "2", text: "long" },
                { value: "3", text: "thicc" },
                { value: "4", text: "custom" },
              ]}
              selected={lengthFilter()}
              onChange={(val) => setLengthFilter(val)}
              settings={{
                showSearch: false,
                placeholderText: "filter by length",
              }}
            />
          </div>
          <Show when={isAuthenticated()}>
            <Button
              aria-label="Show favorite quotes only"
              variant="button"
              fa={{ icon: "fa-heart", fixedWidth: true }}
              active={showFavoritesOnly()}
              onClick={() => setShowFavoritesOnly((v) => !v)}
            />
          </Show>
        </div>
        <div
          class="grid grid-cols-[minmax(0,1fr)] content-baseline gap-2 overflow-y-auto"
          dir={isRtl() ? "rtl" : undefined}
        >
          <For each={pageQuotes()}>
            {(quote) => (
              <Item
                quote={quote}
                matchedTerms={matchedTermsFor(quote.id)}
                isRtl={isRtl()}
                onSelect={() => applyQuote(quote.id)}
                onReport={() => showQuoteReportModal(quote.id)}
                onToggleFavorite={toggleFavorite.bind(null, quote)}
              />
            )}
          </For>
        </div>
        <div
          class={cn(
            "grid grid-cols-2 items-center justify-center gap-2",
            "sm:grid-cols-3",
          )}
        >
          <Button
            aria-label="Previous quote page"
            class="justify-self-end px-10 sm:w-max"
            fa={{ icon: "fa-chevron-left", fixedWidth: true }}
            disabled={currentPage() <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          />
          <div
            class={cn(
              "col-span-2 row-start-1 px-4 text-center text-sub",
              "sm:col-span-1 sm:row-auto",
            )}
          >
            {pageInfo()}
          </div>
          <Button
            aria-label="Next quote page"
            class="px-10 sm:w-max"
            fa={{ icon: "fa-chevron-right", fixedWidth: true }}
            disabled={currentPage() >= totalPages()}
            onClick={() => setCurrentPage((p) => p + 1)}
          />
        </div>
      </AnimatedModal>
      <QuoteSubmitModal />
      <QuoteApproveModal />
    </>
  );
}
