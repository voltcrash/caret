import { describe, expect, it } from "vite-plus/test";
import { setClass } from "../../../../../src/features/typing/components/words/elements";

function classMutations(element: HTMLElement, run: () => void): number {
  const observer = new MutationObserver(() => undefined);
  observer.observe(element, { attributeFilter: ["class"] });
  run();
  const records = observer.takeRecords();
  observer.disconnect();
  return records.length;
}

describe("word setClass", () => {
  it("skips className writes for no-op toggles", () => {
    const word = document.createElement("div");
    word.className = "word active";
    expect(
      classMutations(word, () => {
        setClass(word, "active", true);
        setClass(word, "typed", false);
        setClass(word, ["word", "active"], true);
      }),
    ).toBe(0);
    expect(word.className).toBe("word active");
  });

  it("still writes real class changes", () => {
    const word = document.createElement("div");
    word.className = "word active";
    expect(
      classMutations(word, () => {
        setClass(word, "active", false);
        setClass(word, "typed", true);
      }),
    ).toBe(2);
    expect(word.className).toBe("word typed");
    setClass(null, "x", true);
  });
});
