import { describe, it, expect } from "vite-plus/test";
import { getAllFunboxes } from "../../src/features/typing/runtime/funbox/list";

describe("funbox", () => {
  describe("list", () => {
    it("accounts for every hook in its native or browser owner", () => {
      // Shared word rules were removed from browser hooks. Native generation,
      // source, transform and metadata parity suites exercise these six hooks.
      const native = new Set([
        "getWord",
        "punctuateWord",
        "withWords",
        "alterText",
        "pullSection",
        "getWordsFrequencyMode",
      ]);
      for (const funbox of getAllFunboxes()) {
        const packageFunctions = (funbox.frontendFunctions ?? [])
          .filter((name) => !native.has(name))
          .sort();
        const implementations = Object.keys(funbox.functions ?? {}).sort();

        let message = "has mismatched functions";

        if (packageFunctions.length > implementations.length) {
          message = `missing function implementation in frontend`;
        } else if (implementations.length > packageFunctions.length) {
          message = `missing properties in frontendFunctions in the package`;
        }

        expect(packageFunctions, `Funbox ${funbox.name} ${message}`).toEqual(
          implementations,
        );
      }
    });
  });
});
