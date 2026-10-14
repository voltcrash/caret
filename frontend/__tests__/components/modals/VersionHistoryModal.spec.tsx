import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import { VersionHistoryModal } from "../../../src/ts/components/modals/VersionHistoryModal";
import {
  hideModalAndClearChain,
  showModal,
} from "../../../src/ts/states/modals";
import * as Notifications from "../../../src/ts/states/notifications";
import { getReleaseHistory, Release } from "../../../src/ts/utils/json-data";

vi.mock("../../../src/ts/utils/json-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/ts/utils/json-data")>()),
  getReleaseHistory: vi.fn(),
}));

const history = vi.mocked(getReleaseHistory);
let client: QueryClient;
const releases: Release[] = Array.from({ length: 12 }, (_, i) => ({
  tag_name: `v2026.10.${String(12 - i).padStart(2, "0")}`,
  name: `Release ${12 - i}`,
  published_at: new Date(Date.UTC(2026, 9, 12 - i)).toISOString(),
  body: "### Fixes\n\n- Repair `history`",
}));

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  history.mockReset().mockResolvedValue(releases);
  hideModalAndClearChain("VersionHistory");
  vi.spyOn(Notifications, "showErrorNotification").mockImplementation(() => 0);
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});

afterEach(() => {
  cleanup();
  client.clear();
  hideModalAndClearChain("VersionHistory");
  vi.restoreAllMocks();
});

function renderHistory(): ReturnType<typeof render> {
  return render(() => (
    <QueryClientProvider client={client}>
      <VersionHistoryModal />
    </QueryClientProvider>
  ));
}

it.each(["<script>alert(1)</script>", '<img src="x" onerror="alert(1)">'])(
  "renders release input as text: %s",
  async (input) => {
    history.mockResolvedValue(
      releases.slice(0, 1).map((release) => ({ ...release, body: input })),
    );
    const view = renderHistory();
    showModal("VersionHistory");
    expect(await view.findByText(input)).toBeInTheDocument();
    expect(view.container.querySelector("script, img")).toBeNull();
  },
);

it("waits for opening, renders ten releases, and never fetches more on scroll", async () => {
  const view = renderHistory();
  expect(history).not.toHaveBeenCalled();
  showModal("VersionHistory");
  expect(await view.findByText("Release 12")).toBeInTheDocument();
  expect(view.getAllByText(/^Release \d+$/)).toHaveLength(10);
  expect(view.queryByText("Release 2")).not.toBeInTheDocument();
  expect(view.getByText("12 Oct 2026")).toBeInTheDocument();
  expect(view.getAllByRole("heading", { name: "Fixes" })).toHaveLength(10);
  expect(view.container.querySelector("code")).toHaveTextContent("history");
  const modal = view.container.querySelector(".modal");
  if (modal === null) throw new Error("Missing history modal");
  fireEvent.scroll(modal);
  expect(history).toHaveBeenCalledOnce();
  const older = view.getByRole("link", { name: "Older releases on GitHub" });
  expect(older).toHaveAttribute(
    "href",
    "https://github.com/voltcrash/oxytype/releases",
  );
  expect(older).toHaveAttribute("target", "_blank");
  expect(older).toHaveAttribute("rel", "noreferrer noopener");
});

it("shows an empty state while keeping the GitHub archive accessible", async () => {
  history.mockResolvedValue([]);
  const view = renderHistory();
  showModal("VersionHistory");
  expect(
    await view.findByText("No releases published yet."),
  ).toBeInTheDocument();
  expect(
    view.getByRole("link", { name: "Older releases on GitHub" }),
  ).toBeInTheDocument();
});

it("replaces the loader on failure and keeps the GitHub archive accessible", async () => {
  history.mockRejectedValue(new Error("Cannot load file"));
  const view = renderHistory();
  showModal("VersionHistory");
  expect(
    await view.findByText(/Failed to load version history/),
  ).toBeInTheDocument();
  expect(view.container.querySelector(".preloader")).not.toBeInTheDocument();
  expect(
    view.getByRole("link", { name: "Older releases on GitHub" }),
  ).toBeInTheDocument();
});
