import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { LayoutObjectSchema } from "@oxytype/schemas/layouts";
import { getCharFromLayout } from "../src/layout-emulator";

describe("shared layout mapping", () => {
  const qwerty = LayoutObjectSchema.parse(
    JSON.parse(
      readFileSync(
        new URL(
          "../../../frontend/static/layouts/qwerty.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );
  const dvorak = LayoutObjectSchema.parse(
    JSON.parse(
      readFileSync(
        new URL(
          "../../../frontend/static/layouts/dvorak.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );
  const event = { code: "KeyQ", shift: false, capsLock: false, altGr: false };
  it("maps physical positions with shift and caps lock", () => {
    expect(getCharFromLayout(qwerty, event)).toBe("q");
    expect(getCharFromLayout(dvorak, event)).toBe("'");
    expect(getCharFromLayout(qwerty, { ...event, shift: true })).toBe("Q");
    expect(getCharFromLayout(qwerty, { ...event, capsLock: true })).toBe("Q");
    expect(
      getCharFromLayout(qwerty, { ...event, capsLock: true, shift: true }),
    ).toBe("q");
  });
  it("uses AltGr variants and leaves punctuation caps lock alone", () => {
    const modified = structuredClone(qwerty);
    modified.keys.row2[0] = ["q", "Q", "@", "Ω"];
    expect(getCharFromLayout(modified, { ...event, altGr: true })).toBe("@");
    expect(
      getCharFromLayout(modified, { ...event, altGr: true, shift: true }),
    ).toBe("Ω");
    expect(
      getCharFromLayout(qwerty, { ...event, code: "Quote", capsLock: true }),
    ).toBe("'");
    expect(getCharFromLayout(qwerty, { ...event, code: "Escape" })).toBeNull();
  });
});
