import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  showEditResultTagsModal: vi.fn(),
  userTags: [] as { _id: string }[],
}));

vi.mock("../../../../../src/ts/states/edit-result-tags", () => ({
  showEditResultTagsModal: mocks.showEditResultTagsModal,
}));
vi.mock("../../../../../src/ts/collections/tags", () => ({
  useTagsLiveQuery: () => () => mocks.userTags,
}));

import { ResultTags } from "../../../../../src/features/typing/components/result/ResultTags";
import { setResultState } from "../../../../../src/ts/states/result";

function renderTags(): HTMLElement {
  const { container } = render(() => (
    <ResultTags topClass="top" bottomClass="bottom" />
  ));
  return container.querySelector(".tags") as HTMLElement;
}

describe("ResultTags", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.userTags = [];
    setResultState("tags", {
      visible: false,
      items: [],
      savedResultId: undefined,
    });
  });

  it("is hidden when the user has no tags", () => {
    const tags = renderTags();

    expect(tags).toHaveClass("hidden");
    expect(tags.querySelector(".bottom")).toHaveTextContent("no tags");
  });

  it("lists tags with pb crowns and hovers", () => {
    setResultState("tags", {
      visible: true,
      items: [
        { id: "a", name: "alpha", ariaLabel: "PB: 90", pb: false },
        { id: "b", name: "beta", ariaLabel: "+11.46", pb: true },
        { id: "c", name: "gamma", pb: true },
      ],
    });
    const tags = renderTags();
    const items = tags.querySelectorAll("[tagid]");

    expect(tags).not.toHaveClass("hidden");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("alpha");
    expect(items[0]).toHaveAttribute("aria-label", "PB: 90");
    expect(items[0]?.querySelector(".fa-crown")).toBeNull();
    expect(items[1]).toHaveAttribute("aria-label", "+11.46");
    expect(items[1]?.querySelector(".fa-crown")).not.toBeNull();
    expect(items[2]).not.toHaveAttribute("aria-label");
    expect(items[2]).not.toHaveAttribute("data-balloon-pos");
  });

  it("enables editing once the result is saved", () => {
    mocks.userTags = [{ _id: "a" }];
    setResultState("tags", {
      visible: true,
      items: [{ id: "a", name: "alpha", pb: false }],
    });
    const tags = renderTags();
    const button = tags.querySelector(".editTagsButton") as HTMLElement;

    expect(button).toHaveClass("invisible");

    setResultState("tags", "savedResultId", "result1");
    expect(button).not.toHaveClass("invisible");

    fireEvent.click(button);
    expect(mocks.showEditResultTagsModal).toHaveBeenCalledWith({
      _id: "result1",
      tags: ["a"],
      source: "resultPage",
    });
  });

  it("does not open the modal without user tags", () => {
    setResultState("tags", { visible: true, savedResultId: "result1" });
    const tags = renderTags();

    fireEvent.click(tags.querySelector(".editTagsButton") as HTMLElement);
    expect(mocks.showEditResultTagsModal).not.toHaveBeenCalled();
  });
});
