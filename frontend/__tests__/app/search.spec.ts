import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { serialize } from "zod-urlsearchparams";

import { parseSearch, stringifySearch, urlSearch } from "../../src/app/search";

const schema = z
  .object({
    type: z.enum(["allTime", "daily"]),
    mode2: z.string(),
    page: z.number(),
    yesterday: z.boolean(),
  })
  .partial();

describe("router search codec", () => {
  it("keeps flat legacy values as strings and the first duplicate", () => {
    expect(parseSearch("?mode2=60&page=2&yesterday=t&page=9")).toEqual({
      mode2: "60",
      page: "2",
      yesterday: "t",
    });
  });

  it("writes the same URL the old page classes produced", () => {
    const data = { type: "daily", mode2: "60", page: 2, yesterday: true };
    expect(stringifySearch(data)).toBe(
      `?${serialize({ schema, data: data as z.infer<typeof schema> }).toString()}`,
    );
    expect(stringifySearch({ tab: undefined })).toBe("");
  });

  it("validates typed values and ignores invalid search like PageWithUrlParams", () => {
    const validate = urlSearch(schema);
    expect(validate(parseSearch("?type=daily&page=3&yesterday=true"))).toEqual({
      type: "daily",
      page: 3,
      yesterday: true,
    });
    expect(validate(parseSearch("?type=hourly&page=3"))).toEqual({
      type: undefined,
      mode2: undefined,
      page: undefined,
      yesterday: undefined,
    });
    // Unparsable values are cleared, never merged through from raw search.
    expect(validate(parseSearch("?page=abc")).page).toBeUndefined();
    expect(validate({ page: 2, yesterday: false })).toEqual({
      page: 2,
      yesterday: false,
    });
  });
});
