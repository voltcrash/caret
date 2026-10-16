import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

import { mockHttpFixture } from "../../../../__harness__/operations";

const mocks = vi.hoisted(() => ({
  showQuoteRateModal: vi.fn(),
  showQuoteReportModal: vi.fn(),
  showErrorNotification: vi.fn(),
  addNotificationWithLevel: vi.fn(),
  addQuoteToFavorites: vi.fn(),
  removeQuoteFromFavorites: vi.fn(),
  currentQuote: null as { id: number } | null,
  snapshot: undefined as
    | { favoriteQuotes?: Record<string, string[]> }
    | undefined,
}));

vi.mock("../../../../../src/ts/states/quote-rate", () => ({
  showQuoteRateModal: mocks.showQuoteRateModal,
}));
vi.mock("../../../../../src/ts/states/quote-report", () => ({
  showQuoteReportModal: mocks.showQuoteReportModal,
}));
vi.mock("../../../../../src/ts/states/notifications", () => ({
  showErrorNotification: mocks.showErrorNotification,
  addNotificationWithLevel: mocks.addNotificationWithLevel,
}));
vi.mock("../../../../../src/ts/states/loader-bar", () => ({
  showLoaderBar: vi.fn(),
  hideLoaderBar: vi.fn(),
}));
vi.mock("../../../../../src/ts/states/test", () => ({
  getCurrentQuote: () => mocks.currentQuote,
}));
vi.mock("../../../../../src/ts/db", () => ({
  getSnapshot: () => mocks.snapshot,
  updateLocalQuoteFavorite: (
    language: string,
    id: string,
    favorite: boolean,
  ) => {
    const snapshot = mocks.snapshot;
    if (snapshot === undefined) return;
    snapshot.favoriteQuotes ??= {};
    const ids = snapshot.favoriteQuotes[language] ?? [];
    snapshot.favoriteQuotes[language] = favorite
      ? [...ids, id]
      : ids.filter((value) => value !== id);
  },
}));

import { ResultQuoteActions } from "../../../../../src/features/typing/components/result/ResultQuoteActions";
import { setResultState } from "../../../../../src/ts/states/result";

function renderActions(): Record<"report" | "favorite" | "rate", HTMLElement> {
  const { container } = render(() => <ResultQuoteActions />);
  const get = (id: string): HTMLElement =>
    container.querySelector(`#${id}`) as HTMLElement;
  return {
    report: get("reportQuoteButton"),
    favorite: get("favoriteQuoteButton"),
    rate: get("rateQuoteButton"),
  };
}

describe("ResultQuoteActions", () => {
  beforeEach(() => {
    mocks.currentQuote = { id: 7 };
    mocks.snapshot = { favoriteQuotes: { english: ["3"] } };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    setResultState("quote", {
      language: undefined,
      id: "",
      favoriteVisible: false,
      favorite: false,
      rateVisible: false,
      rated: false,
      rating: "",
      reportVisible: false,
    });
  });

  it("is hidden by default", () => {
    const { report, favorite, rate } = renderActions();

    expect(report).toHaveClass("hidden");
    expect(favorite).toHaveClass("hidden");
    expect(rate).toHaveClass("hidden");
    expect(favorite.querySelector(".icon")).toHaveClass("far");
    expect(rate.querySelector(".icon")).toHaveClass("far");
  });

  it("shows rating and favorite state", () => {
    setResultState("quote", {
      reportVisible: true,
      favoriteVisible: true,
      favorite: true,
      rateVisible: true,
      rated: true,
      rating: "4.2",
    });
    const { report, favorite, rate } = renderActions();

    expect(report).not.toHaveClass("hidden");
    expect(favorite).not.toHaveClass("hidden");
    expect(favorite.querySelector(".icon")).toHaveClass("fas");
    expect(rate.querySelector(".icon")).toHaveClass("fas");
    expect(rate.querySelector(".rating")).toHaveTextContent("4.2");
  });

  it("opens report and rate modals for the current quote", () => {
    const { report, rate } = renderActions();

    fireEvent.click(report);
    expect(mocks.showQuoteReportModal).toHaveBeenCalledWith(7);

    fireEvent.click(rate);
    expect(mocks.showQuoteRateModal).toHaveBeenCalledWith({ id: 7 });
  });

  it("errors without a current quote", () => {
    mocks.currentQuote = null;
    const { report, rate } = renderActions();

    fireEvent.click(report);
    fireEvent.click(rate);
    expect(mocks.showQuoteReportModal).not.toHaveBeenCalled();
    expect(mocks.showQuoteRateModal).not.toHaveBeenCalled();
    expect(mocks.showErrorNotification).toHaveBeenCalledTimes(2);
  });

  it("adds and removes favorites", async () => {
    mocks.addQuoteToFavorites.mockResolvedValue({
      status: 200,
      body: { message: "added" },
    });
    mocks.removeQuoteFromFavorites.mockResolvedValue({
      status: 200,
      body: { message: "removed" },
    });
    setResultState("quote", {
      language: "english",
      id: "7",
      favoriteVisible: true,
    });
    const { favorite } = renderActions();
    const icon = favorite.querySelector(".icon") as HTMLElement;

    fireEvent.click(favorite);
    await waitFor(() => expect(icon).toHaveClass("fas"));
    expect(mocks.addQuoteToFavorites).toHaveBeenCalledWith({
      body: { language: "english", quoteId: "7" },
    });
    expect(mocks.snapshot?.favoriteQuotes?.["english"]).toEqual(["3", "7"]);

    fireEvent.click(favorite);
    await waitFor(() => expect(icon).toHaveClass("far"));
    expect(mocks.removeQuoteFromFavorites).toHaveBeenCalled();
    expect(mocks.snapshot?.favoriteQuotes?.["english"]).toEqual(["3"]);
  });

  it("keeps the favorite state when the request fails", async () => {
    mocks.addQuoteToFavorites.mockResolvedValue({
      status: 500,
      body: { message: "nope" },
    });
    setResultState("quote", {
      language: "english",
      id: "7",
      favoriteVisible: true,
    });
    const { favorite } = renderActions();

    fireEvent.click(favorite);
    await waitFor(() =>
      expect(mocks.addNotificationWithLevel).toHaveBeenCalledWith(
        "nope",
        "error",
      ),
    );
    expect(favorite.querySelector(".icon")).toHaveClass("far");
  });
});

mockHttpFixture(
  "users.addQuoteToFavorites",
  async (input) => await mocks.addQuoteToFavorites(input),
);

mockHttpFixture(
  "users.removeQuoteFromFavorites",
  async (input) => await mocks.removeQuoteFromFavorites(input),
);
