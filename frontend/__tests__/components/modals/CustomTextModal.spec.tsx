import { cleanup, fireEvent, render, within } from "@solidjs/testing-library";
import { onMount, type ParentProps } from "solid-js";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  notice: vi.fn(),
  hide: vi.fn(),
  setConfig: vi.fn(),
}));
vi.mock("../../../src/ts/components/common/AnimatedModal", () => ({
  AnimatedModal: (
    props: ParentProps<{
      beforeShow: (chained: boolean) => void;
      afterShow: () => void;
    }>,
  ) => {
    onMount(() => {
      props.beforeShow(false);
      props.afterShow();
    });
    return <div>{props.children}</div>;
  },
}));
vi.mock("../../../src/ts/components/modals/CustomGeneratorModal", () => ({
  CustomGeneratorModal: () => null,
}));
vi.mock("../../../src/ts/components/modals/SaveCustomTextModal", () => ({
  SaveCustomTextModal: () => null,
}));
vi.mock("../../../src/ts/components/modals/SavedTextsModal", () => ({
  SavedTextsModal: () => null,
}));
vi.mock("../../../src/ts/components/modals/WordFilterModal", () => ({
  WordFilterModal: () => null,
}));
vi.mock("../../../src/ts/states/modals", () => ({
  hideModalAndClearChain: mocks.hide,
  showModal: vi.fn(),
}));
vi.mock("../../../src/ts/states/core", () => ({
  getCustomTextIndicator: () => undefined,
  setCustomTextIndicator: vi.fn(),
}));
vi.mock("../../../src/ts/states/test", () => ({
  getLoadedChallenge: () => null,
  setLoadedChallenge: vi.fn(),
}));
vi.mock("../../../src/ts/states/notifications", () => ({
  showNoticeNotification: mocks.notice,
  showErrorNotification: vi.fn(),
}));
vi.mock("../../../src/ts/config/setters", () => ({
  setConfig: mocks.setConfig,
}));
vi.mock("../../../src/ts/test/practise-words", () => ({
  resetBefore: vi.fn(),
}));
vi.mock("../../../src/ts/utils/bail-out", () => ({
  getBailOutHint: () => "Use escape",
}));

import { CustomTextModal } from "../../../src/ts/components/modals/CustomTextModal";
import { getMutableConfig } from "../../../src/ts/config/store";
import * as CustomText from "../../../src/ts/test/custom-text";

beforeEach(() => {
  vi.clearAllMocks();
  getMutableConfig().mode = "words";
  CustomText.setText(["hello", "world"]);
  CustomText.setMode("repeat");
  CustomText.setPipeDelimiter(false);
  CustomText.setLimitMode("word");
  CustomText.setLimitValue(2);
});
afterEach(cleanup);

describe("CustomTextModal", () => {
  it("loads saved state and submits normalized text in simple mode", async () => {
    const view = render(() => <CustomTextModal />);
    const textarea = view.getByRole<HTMLTextAreaElement>("textbox");
    expect(textarea.value).toBe("hello world");
    fireEvent.input(textarea, {
      target: { value: " one\u00a0two  \n three " },
    });
    fireEvent.click(view.getByRole("button", { name: "ok" }));
    await vi.waitFor(() =>
      expect(mocks.hide).toHaveBeenCalledWith("CustomText"),
    );
    expect(CustomText.getText()).toEqual(["one", "two\n", "three"]);
    expect(CustomText.getMode()).toBe("repeat");
    expect(CustomText.getLimit()).toEqual({ mode: "word", value: 3 });
    expect(mocks.setConfig).toHaveBeenCalledWith("mode", "custom");
  });

  it("converts delimiters and uses section limits for simple pipe texts", async () => {
    const view = render(() => <CustomTextModal />);
    fireEvent.click(view.getByRole("button", { name: "pipe" }));
    expect(view.getByRole<HTMLTextAreaElement>("textbox").value).toBe(
      "hello|world",
    );
    fireEvent.input(view.getByRole<HTMLTextAreaElement>("textbox"), {
      target: { value: "one two|three four" },
    });
    fireEvent.click(view.getByRole("button", { name: "ok" }));
    await vi.waitFor(() => expect(mocks.hide).toHaveBeenCalled());
    expect(CustomText.getText()).toEqual(["one two", "three four"]);
    expect(CustomText.getPipeDelimiter()).toBe(true);
    expect(CustomText.getLimit()).toEqual({ mode: "section", value: 2 });
  });

  it("sets a word limit when entering shuffle mode and changes it to time", async () => {
    const view = render(() => <CustomTextModal />);
    fireEvent.click(view.getByRole("button", { name: "shuffle" }));
    expect(view.getByPlaceholderText("words")).toHaveValue(2);
    fireEvent.input(view.getByPlaceholderText("time"), {
      target: { value: "15" },
    });
    expect(view.getByPlaceholderText("words")).toHaveValue(null);
    fireEvent.click(view.getByRole("button", { name: "ok" }));
    await vi.waitFor(() => expect(mocks.hide).toHaveBeenCalled());
    expect(CustomText.getMode()).toBe("shuffle");
    expect(CustomText.getLimit()).toEqual({ mode: "time", value: 15 });
  });

  it("rejects empty input and modes without a limit", async () => {
    const view = render(() => <CustomTextModal />);
    fireEvent.input(view.getByRole<HTMLTextAreaElement>("textbox"), {
      target: { value: "" },
    });
    fireEvent.click(view.getByRole("button", { name: "ok" }));
    await vi.waitFor(() =>
      expect(mocks.notice).toHaveBeenCalledWith("Text cannot be empty"),
    );
    fireEvent.input(view.getByRole<HTMLTextAreaElement>("textbox"), {
      target: { value: "one two" },
    });
    fireEvent.click(view.getByRole("button", { name: "random" }));
    fireEvent.input(view.getByPlaceholderText("words"), {
      target: { value: "" },
    });
    fireEvent.click(view.getByRole("button", { name: "ok" }));
    await vi.waitFor(() =>
      expect(mocks.notice).toHaveBeenCalledWith("You need to specify a limit", {
        durationMs: 5000,
      }),
    );
    expect(mocks.hide).not.toHaveBeenCalled();
  });

  it("keeps cleanup controls and tab insertion behavior", () => {
    const view = render(() => <CustomTextModal />);
    const textarea = view.getByRole<HTMLTextAreaElement>("textbox");
    fireEvent.input(textarea, { target: { value: "one\u200btwo\nthree" } });
    const removeGroup = view.getByText("Remove zero-width characters")
      .parentElement as HTMLElement;
    fireEvent.click(within(removeGroup).getByRole("button", { name: "apply" }));
    expect(textarea.value).toBe("onetwo\nthree");
    const newlineGroup = view.getByText("Replace new lines with spaces")
      .parentElement as HTMLElement;
    fireEvent.click(
      within(newlineGroup).getByRole("button", { name: "period + space" }),
    );
    expect(textarea.value).toBe("onetwo. three");
    textarea.setSelectionRange(3, 3);
    fireEvent.keyDown(textarea, { key: "Tab" });
    expect(textarea.value).toBe("one\ttwo. three");
    expect(textarea.selectionStart).toBe(4);
  });
});
