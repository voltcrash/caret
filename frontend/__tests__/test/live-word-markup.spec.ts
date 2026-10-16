import { beforeEach, describe, expect, it } from "vite-plus/test";
import {
  buildInitialWordNodes,
  clearWordTemplates,
} from "../../src/features/typing/components/words/initial";
import { buildLiveWordNodes } from "../../src/features/typing/components/words/live";

function build(
  options: Partial<Parameters<typeof buildLiveWordNodes>[0]>,
): ReturnType<typeof buildLiveWordNodes> {
  return buildLiveWordNodes({
    currentWord: "hello",
    input: "",
    compositionData: "",
    zen: false,
    indicateTypos: "off",
    compositionDisplay: "off",
    ...options,
  });
}

beforeEach(clearWordTemplates);

describe("live word node builders", () => {
  it("preserves Unicode letters and newline spacer structure", () => {
    const nodes = buildInitialWordNodes("a👍\n", 4);
    expect(nodes.querySelector(".word")?.getAttribute("data-wordindex")).toBe(
      "4",
    );
    expect(
      Array.from(nodes.querySelectorAll("letter"), (node) => node.textContent),
    ).toEqual(["a", "👍", ""]);
    expect(
      nodes.querySelector("letter.nlChar i.fa-level-down-alt"),
    ).not.toBeNull();
    expect(Array.from(nodes.children, (node) => node.className)).toEqual([
      "word",
      "beforeNewline",
      "newline",
      "afterNewline",
    ]);
  });
  it("preserves typo replacement, adjacency and extra-space classes", () => {
    const result = build({ input: "hxzlo ", indicateTypos: "both" });
    expect(result.nodes.querySelector("letter.correct")?.textContent).toBe("h");
    expect(result.nodes.querySelector("letter.incorrect")?.textContent).toBe(
      "x",
    );
    expect(
      result.nodes.querySelector("letter.incorrect.extra")?.textContent,
    ).toBe("_");
    expect(result.hintIndices).toEqual([[1, 2]]);
  });
  it("retains dead composition classes and remaining untyped letters", () => {
    const nodes = build({ input: "h", compositionData: "e" }).nodes;
    expect(nodes.querySelector("letter.dead.correct")?.textContent).toBe("e");
    expect(nodes.querySelector("letter.dead")?.nextSibling?.textContent).toBe(
      "l",
    );
    expect(
      build({
        input: "h",
        compositionData: "x",
        compositionDisplay: "replace",
      }).nodes.querySelector("letter.dead")?.textContent,
    ).toBe("x");
  });
  it("keeps zen placeholders and newline insertion flags", () => {
    expect(
      build({ zen: true }).nodes.querySelector("letter.invisible")?.textContent,
    ).toBe("_");
    const result = build({ zen: true, input: "a\n" });
    expect(result.newlineafter).toBe(true);
    expect(
      result.nodes.querySelector<HTMLElement>("letter.nlChar.correct")?.style
        .opacity,
    ).toBe("0");
  });
  it("uses the injected funbox renderer for typed and untyped targets", () => {
    const getWordNode = (char: string): Node =>
      document.createTextNode(char.toUpperCase());
    expect(buildInitialWordNodes("ab", 0, getWordNode).textContent).toBe("AB");
    const result = build({ currentWord: "ab", input: "a", getWordNode });
    expect(result.nodes.textContent).toBe("AB");
    expect(result.nodes.querySelector("letter.correct")?.textContent).toBe("A");
  });
  it.each(["<&\"'", "שלום", "عربي", "👩‍💻"])(
    "renders literal special characters: %s",
    (word) => {
      const initial = buildInitialWordNodes(word, 0);
      expect(initial.textContent).toBe(word);
      expect(initial.querySelector("script, img, b")).toBeNull();
      const live = build({ currentWord: word, input: word }).nodes;
      expect(live.textContent).toBe(word);
      expect(live.querySelector("script, img, b")).toBeNull();
    },
  );
  it("renders replaced and extra input literally", () => {
    const nodes = build({
      currentWord: "ab",
      input: '<&"',
      indicateTypos: "replace",
    }).nodes;
    expect(nodes.textContent).toBe('<&"');
    expect(nodes.querySelector("letter.extra")?.textContent).toBe('"');
  });
  it("keeps cached word nodes independent of typing mutations and indices", () => {
    const first = buildInitialWordNodes("safe", 1);
    const letter = first.querySelector("letter");
    if (letter === null) throw new Error("Missing letter");
    letter.textContent = "changed";
    letter.className = "incorrect";
    const second = buildInitialWordNodes("safe", 2);
    expect(second.textContent).toBe("safe");
    expect(second.querySelector(".incorrect")).toBeNull();
    expect(second.querySelector(".word")?.getAttribute("data-wordindex")).toBe(
      "2",
    );
  });
  it("never caches funbox callbacks", () => {
    expect(buildInitialWordNodes("a", 0).textContent).toBe("a");
    expect(
      buildInitialWordNodes("a", 0, () => document.createTextNode("b"))
        .textContent,
    ).toBe("b");
    expect(
      buildInitialWordNodes("a", 0, () => document.createTextNode("c"))
        .textContent,
    ).toBe("c");
  });
  it("renders tab and newline icons through Fa without shared node ownership", () => {
    const first = buildInitialWordNodes("\t\n", 0);
    const second = buildInitialWordNodes("\t\n", 1);
    expect(first.querySelectorAll("i.fa-fw")).toHaveLength(2);
    expect(second.querySelectorAll("i.fa-fw")).toHaveLength(2);
    expect(first.querySelector("i")).not.toBe(second.querySelector("i"));
  });
});
