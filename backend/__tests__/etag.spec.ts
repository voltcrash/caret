import { COMPATIBILITY_CHECK } from "@oxytype/contracts";
import { expect, it } from "vite-plus/test";
import { createETagGenerator } from "../src/utils/etag";

it.for([true, false])(
  "preserves compatibility prefixes for weak=%s",
  (weak) => {
    const generate = createETagGenerator({ weak });
    const textTag = generate("payload", "utf8");
    expect(textTag).toBe(generate(Buffer.from("payload"), undefined));
    expect(
      textTag.startsWith(
        weak ? `W/"V${COMPATIBILITY_CHECK}-` : `"V${COMPATIBILITY_CHECK}-`,
      ),
    ).toBe(true);
  },
);

it("matches the express etag format", () => {
  const v = `V${COMPATIBILITY_CHECK}`;
  expect(createETagGenerator({ weak: true })("payload", "utf8")).toBe(
    `W/"${v}-7-8H5agVYTxavt3EtoIkekxC2Kld8"`,
  );
  expect(
    createETagGenerator({ weak: false })(Buffer.from("héllo"), undefined),
  ).toBe(`"${v}-6-NbXqRcXkH3i0apN8x01B3+qSCJA"`);
  expect(createETagGenerator({ weak: false })("", "utf8")).toBe(
    `"${v}-0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"`,
  );
});
