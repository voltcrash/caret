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
