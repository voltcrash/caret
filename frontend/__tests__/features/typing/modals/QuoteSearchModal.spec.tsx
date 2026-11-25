import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import { onMount, ParentProps } from "solid-js";
import { afterEach, expect, it, vi } from "vite-plus/test";

const { getQuotes } = vi.hoisted(() => ({ getQuotes: vi.fn() }));
vi.mock("../../../../src/features/typing/runtime/quotes-controller", () => ({
  default: { getQuotes, isQuoteFavorite: () => false },
}));
vi.mock("../../../../src/ts/components/common/AnimatedModal", () => ({
  AnimatedModal: (props: ParentProps<{ afterShow?: () => Promise<void> }>) => {
    onMount(() => void props.afterShow?.());
    return <div>{props.children}</div>;
  },
}));
vi.mock("../../../../src/features/typing/modals/QuoteSubmitModal", () => ({
  QuoteSubmitModal: () => null,
}));
vi.mock("../../../../src/features/typing/modals/QuoteApproveModal", () => ({
  QuoteApproveModal: () => null,
}));
vi.mock("../../../../src/ts/components/ui/Select", () => ({
  default: () => null,
}));
vi.mock("../../../../src/ts/utils/json-data", () => ({
  getLanguage: async () => ({ rightToLeft: false }),
}));
vi.mock("../../../../src/ts/config/store", () => ({
  peekConfig: (() => {
    const storedConfig = { language: "english" };
    return () => storedConfig;
  })(),
}));
vi.mock("../../../../src/ts/config/setters", () => ({ setConfig: vi.fn() }));
vi.mock("../../../../src/ts/db", () => ({ getSnapshot: () => undefined }));

vi.mock("../../../../src/ts/states/core", () => ({
  isAuthenticated: () => false,
}));
vi.mock("../../../../src/ts/states/modals", () => ({
  isModalOpen: () => true,
  showModal: vi.fn(),
  hideModalAndClearChain: vi.fn(),
}));
vi.mock("../../../../src/ts/states/test", () => ({}));
vi.mock(
  "../../../../src/features/typing/state/quote-selection",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../../../src/features/typing/state/quote-selection")
    >()),
    setSelectedQuoteId: vi.fn(),
  }),
);
vi.mock("../../../../src/features/typing/state/quote-report", () => ({
  showQuoteReportModal: vi.fn(),
}));
vi.mock("../../../../src/ts/states/simple-modal", () => ({
  showSimpleModal: vi.fn(),
}));
vi.mock("../../../../src/features/typing/runtime/test/logic", () => ({
  restart: vi.fn(),
}));

import { QuoteSearchModal } from "../../../../src/features/typing/modals/QuoteSearchModal";

afterEach(cleanup);

it.each(["<script>alert(1)</script>", '<img src="x" onerror="alert(1)">'])(
  "renders quote text and source as text while highlighting %s",
  async (input) => {
    getQuotes.mockResolvedValue({
      quotes: [
        {
          id: 123,
          text: input,
          source: input,
          length: 40,
          group: 0,
          language: "english",
        },
      ],
    });
    const view = render(() => <QuoteSearchModal />);
    await waitFor(() => expect(view.container.textContent).toContain(input));
    expect(view.container.textContent?.split(input)).toHaveLength(3);
    expect(view.container.querySelector("script, img")).toBeNull();
    fireEvent.input(view.getByPlaceholderText("filter by text, source or id"), {
      target: {
        value: `"${input.startsWith("<script>") ? input : "onerror"}"`,
      },
    });
    await waitFor(() =>
      expect(view.container.querySelectorAll(".highlight")).toHaveLength(2),
    );
    expect(view.container.querySelector("script, img")).toBeNull();
    expect(view.container.textContent?.split(input)).toHaveLength(3);
  },
);

it("supports exact, prefix, typo, source-boosted, and non-English queries", async () => {
  getQuotes.mockResolvedValue({
    quotes: [
      {
        id: 10,
        text: "A philosopher reads Shakespeare late at night.",
        source: "Modern Notes",
        length: 46,
        group: 0,
        language: "english",
      },
      {
        id: 20,
        text: "All the world is a stage and all the men and women merely players.",
        source: "William Shakespeare",
        length: 66,
        group: 0,
        language: "english",
      },
      {
        id: 30,
        text: "Un café chaud et des petits déjeuners au soleil.",
        source: "Chimène Badi",
        length: 48,
        group: 0,
        language: "french",
      },
    ],
  });

  const view = render(() => <QuoteSearchModal />);
  const input = view.getByPlaceholderText("filter by text, source or id");
  await waitFor(() =>
    expect(view.container.textContent).toContain("1 - 3 of 3"),
  );

  // Prefix match on source boosts source match ahead of text mention
  fireEvent.input(input, { target: { value: "shake" } });
  await waitFor(() =>
    expect(view.container.textContent).toContain("1 - 2 of 2"),
  );
  const textContent = view.container.textContent ?? "";
  expect(textContent.indexOf("William Shakespeare")).toBeLessThan(
    textContent.indexOf("Modern Notes"),
  );

  // Typo match
  fireEvent.input(input, { target: { value: "philosohper" } });
  await waitFor(() =>
    expect(view.container.querySelector(".highlight")?.textContent).toBe(
      "philosopher",
    ),
  );
  expect(view.container.textContent).toContain("1 - 1 of 1");
  expect(view.container.textContent).toContain("Modern Notes");

  // Non-English quote with diacritic folding & highlight
  fireEvent.input(input, { target: { value: "dejeuners" } });
  await waitFor(() =>
    expect(view.container.querySelector(".highlight")?.textContent).toBe(
      "déjeuners",
    ),
  );
  expect(view.container.textContent).toContain("1 - 1 of 1");
  expect(view.container.textContent).toContain("Chimène Badi");
});
