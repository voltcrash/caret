import MiniSearch from "minisearch";

import type { Quote } from "../runtime/quotes-controller";

type QuoteSearchResult = {
  results: Quote[];
  matchedQueryTerms: string[];
  matchedTermsById: Map<number, string[]>;
};

export type QuoteSearchIndex = {
  query: (
    searchQuery: string,
    allowedIds?: readonly number[],
  ) => QuoteSearchResult;
};

type IndexedQuote = {
  idx: number;
  id: string;
  text: string;
  source: string;
};

// Keep letters, digits and combining marks together so scripts with essential
// marks (Devanagari, Thai, Arabic, etc.) stay intact while punctuation and
// symbols split cleanly.
const TOKEN_PATTERN = /[\p{L}\p{N}\p{M}]+/gu;
// Fold diacritics on Latin letters only (e.g. café -> cafe) without stripping
// vowel marks or kana dakuten in non-Latin scripts.
const LATIN_DIACRITIC_PATTERN = /(?<=\p{Script=Latin})\p{Mn}+/gu;
const DIGITS_ONLY_PATTERN = /^\p{N}+$/u;
const HAN_CHAR_PATTERN = /\p{Script=Han}/u;

const FIELD_BOOSTS = {
  id: 3,
  source: 2,
  text: 1,
} as const;

const MATCH_WEIGHTS = {
  prefix: 0.6,
  fuzzy: 0.4,
} as const;

function tokenize(text: string): string[] {
  return text.match(TOKEN_PATTERN) ?? [];
}

function normalizeTerm(term: string): string {
  return term
    .normalize("NFD")
    .replace(LATIN_DIACRITIC_PATTERN, "")
    .normalize("NFC")
    .toLowerCase();
}

function allowPrefix(term: string): boolean {
  return term.length >= 2 || HAN_CHAR_PATTERN.test(term);
}

function fuzzyTolerance(term: string): number | false {
  if (term.length < 4 || DIGITS_ONLY_PATTERN.test(term)) {
    return false;
  }
  return 0.2;
}

export function buildQuoteSearchIndex(
  quotes: readonly Quote[],
): QuoteSearchIndex {
  const originalsByTerm = new Map<string, Set<string>>();

  const index = new MiniSearch<IndexedQuote>({
    idField: "idx",
    fields: ["text", "source", "id"],
    tokenize,
    processTerm: (term, fieldName) => {
      const normalized = normalizeTerm(term);
      if (normalized === "") return null;
      if (fieldName !== undefined) {
        let originals = originalsByTerm.get(normalized);
        if (originals === undefined) {
          originals = new Set();
          originalsByTerm.set(normalized, originals);
        }
        originals.add(term);
      }
      return normalized;
    },
    searchOptions: {
      boost: FIELD_BOOSTS,
      weights: MATCH_WEIGHTS,
      prefix: allowPrefix,
      fuzzy: fuzzyTolerance,
      maxFuzzy: 2,
      combineWith: "OR",
      processTerm: (term) => {
        const normalized = normalizeTerm(term);
        return normalized === "" ? null : normalized;
      },
    },
  });

  if (quotes.length > 0) {
    index.addAll(
      quotes.map((quote, idx) => ({
        idx,
        id: String(quote.id),
        text: quote.text,
        source: quote.source,
      })),
    );
  }

  const query = (
    searchQuery: string,
    allowedIds?: readonly number[],
  ): QuoteSearchResult => {
    const uniqueTerms = [
      ...new Set(
        tokenize(searchQuery)
          .map(normalizeTerm)
          .filter((term) => term !== ""),
      ),
    ];

    if (uniqueTerms.length === 0 || quotes.length === 0) {
      return {
        results: [],
        matchedQueryTerms: [],
        matchedTermsById: new Map(),
      };
    }

    const allowedIdSet =
      allowedIds !== undefined && allowedIds.length > 0
        ? new Set(allowedIds)
        : undefined;

    const hits = index.search(uniqueTerms.join(" "), {
      filter:
        allowedIdSet === undefined
          ? undefined
          : (result) => {
              const quote = quotes[result.id as number];
              return quote !== undefined && allowedIdSet.has(quote.id);
            },
    });

    const results: Quote[] = [];
    const matchedQueryTerms = new Set<string>();
    const matchedTermsById = new Map<number, string[]>();

    for (const hit of hits) {
      const quote = quotes[hit.id as number];
      if (quote === undefined) continue;
      results.push(quote);

      const quoteTerms = new Set<string>();
      for (const term of hit.terms) {
        const originals = originalsByTerm.get(term);
        if (originals !== undefined) {
          for (const original of originals) {
            quoteTerms.add(original);
            matchedQueryTerms.add(original);
          }
        } else {
          quoteTerms.add(term);
          matchedQueryTerms.add(term);
        }
      }
      matchedTermsById.set(quote.id, [...quoteTerms]);
    }

    return {
      results,
      matchedQueryTerms: [...matchedQueryTerms],
      matchedTermsById,
    };
  };

  return { query };
}
