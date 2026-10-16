import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import { onMount, ParentProps } from "solid-js";
import { afterEach, expect, it, vi } from "vite-plus/test";

const { getQuotes } = vi.hoisted(() => ({ getQuotes: vi.fn() }));
vi.mock("../../../src/ts/controllers/quotes-controller", () => ({
  default: { getQuotes, isQuoteFavorite: () => false },
}));
vi.mock("../../../src/ts/components/common/AnimatedModal", () => ({
  AnimatedModal: (props: ParentProps<{ afterShow?: () => Promise<void> }>) => {
    onMount(() => void props.afterShow?.());
    return <div>{props.children}</div>;
  },
}));
vi.mock("../../../src/ts/components/modals/QuoteSubmitModal", () => ({
  QuoteSubmitModal: () => null,
}));
vi.mock("../../../src/ts/components/modals/QuoteApproveModal", () => ({
  QuoteApproveModal: () => null,
}));
vi.mock("../../../src/ts/components/ui/Select", () => ({
  default: () => null,
}));
vi.mock("../../../src/ts/utils/json-data", () => ({
  getLanguage: async () => ({ rightToLeft: false }),
}));
vi.mock("../../../src/ts/config/store", () => ({
  getMutableConfig: (() => {
    const storedConfig = { language: "english" };
    return () => storedConfig;
  })(),
}));
vi.mock("../../../src/ts/config/setters", () => ({ setConfig: vi.fn() }));
vi.mock("../../../src/ts/db", () => ({ getSnapshot: () => undefined }));
vi.mock("../../../src/ts/ape", () => ({ default: {} }));
vi.mock("../../../src/ts/states/core", () => ({
  isAuthenticated: () => false,
}));
vi.mock("../../../src/ts/states/modals", () => ({
  isModalOpen: () => true,
  showModal: vi.fn(),
  hideModalAndClearChain: vi.fn(),
}));
vi.mock("../../../src/ts/states/test", () => ({ setSelectedQuoteId: vi.fn() }));
vi.mock("../../../src/ts/states/quote-report", () => ({
  showQuoteReportModal: vi.fn(),
}));
vi.mock("../../../src/ts/states/simple-modal", () => ({
  showSimpleModal: vi.fn(),
}));
vi.mock("../../../src/features/typing/runtime/test-logic", () => ({
  restart: vi.fn(),
}));

import { QuoteSearchModal } from "../../../src/ts/components/modals/QuoteSearchModal";

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
