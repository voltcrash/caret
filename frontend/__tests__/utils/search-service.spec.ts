import levenshtein from "damerau-levenshtein";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import { buildSearchService } from "../../src/ts/utils/search-service";

vi.mock("damerau-levenshtein", { spy: true });
beforeEach(() => vi.clearAllMocks());

const documents = [
  { id: 42, text: "quick brown fox" },
  { id: 7, text: "slow brown bear" },
  { id: 99, text: "quicker fox fox" },
];
const search = (): ReturnType<
  typeof buildSearchService<(typeof documents)[number]>
> => buildSearchService(documents, (document) => document.text);

it("preserves ranking, stemming, highlighting and transposed typo matches", () => {
  expect(
    search()
      .query("fox", [])
      .results.map((document) => document.id),
  ).toEqual([42, 99]);
  expect(
    search()
      .query("quikc", [])
      .results.map((document) => document.id),
  ).toEqual([42]);
  expect(search().query("brown", []).matchedQueryTerms).toEqual(["brown"]);
  expect(search().query("fox fox", [])).toEqual(search().query("fox", []));
});

it("filters by external document IDs, not positions", () => {
  expect(search().query("fox", [42]).results).toEqual([documents[0]]);
  expect(search().query("fox", [0]).results).toEqual([]);
  expect(search().query("!!!", []).results).toEqual([]);
  expect(buildSearchService([], String).query("fox", [])).toEqual({
    results: [],
    matchedQueryTerms: [],
  });
});

it("does not allocate an edit-distance matrix for exact matches", () => {
  const service = buildSearchService(["fox"], String);
  expect(service.query("fox", []).results).toEqual(["fox"]);
  expect(levenshtein).not.toHaveBeenCalled();
});
