import { createHash } from "node:crypto";
import { expect, it } from "vite-plus/test";
import { z } from "zod";
import { safeParse, serialize } from "../../src/app/url-search-params";

// Frozen against the patched 0.0.16 package before removing it.
it("preserves legacy scalar, repeated, default, transform and UTF-8 encodings", () => {
  const schema = z.object({
    page: z.number().default(0),
    flag: z.boolean().optional(),
    tab: z.enum(["sound", "theme"]).optional(),
    tags: z.array(z.string()),
    nested: z.object({ text: z.string() }).optional(),
    piped: z
      .string()
      .transform((value) => value.toUpperCase())
      .optional(),
  });
  const digest = createHash("sha256");
  const atoms = [
    "",
    "0",
    "1",
    "-2",
    "2.5",
    " 3 ",
    "NaN",
    "Infinity",
    "t",
    "f",
    "true",
    "false",
    "TRUE",
    "sound",
    "theme",
    "한글🙂",
    "eyJ0ZXh0Ijoi8J+ZgiJ9",
    "bad+base64",
  ];
  for (const key of Object.keys(schema.shape)) {
    for (const atom of atoms) {
      for (const duplicate of [false, true]) {
        const input = new URLSearchParams([[key, atom]]);
        if (duplicate) input.append(key, "1");
        const result = safeParse({ schema, input });
        digest.update(
          JSON.stringify(result.success ? result.data : result.error.issues),
        );
      }
    }
  }
  for (let page = 0; page < 20; page++) {
    const data = {
      page,
      flag: page % 2 === 0,
      tab: "theme" as const,
      tags: ["한글", "a&b"],
      nested: { text: "🙂" },
      piped: "hello",
    };
    digest.update(serialize({ schema, data }).toString());
    digest.update(
      serialize({
        schema,
        data,
        defaultData: { flag: false, tab: "theme" },
      }).toString(),
    );
  }
  expect(digest.digest("hex")).toBe(
    "9c7061b08bfcf4099ad131d3a55382fb0aaeda52f3abf11f867600f21699ec54",
  );
});

it("retains the last scalar duplicate and omits default values", () => {
  const schema = z.object({
    page: z.number().default(0),
    flag: z.boolean().optional(),
  });
  expect(
    safeParse({
      schema,
      input: new URLSearchParams("page=1&page=2&flag=true"),
    }),
  ).toMatchObject({ success: true, data: { page: 2, flag: true } });
  expect(serialize({ schema, data: { page: 0, flag: false } }).toString()).toBe(
    "flag=f",
  );
});
