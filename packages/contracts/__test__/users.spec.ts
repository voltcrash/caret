import { describe, it, expect } from "vite-plus/test";
import { GetProfileQuerySchema } from "@oxytype/contracts/users";

describe("GetProfileQuerySchema", () => {
  it.for([
    { query: {}, expected: { isUid: false } },
    // bare `?isUid` flag
    { query: { isUid: "" }, expected: { isUid: true } },
    // json query clients
    { query: { isUid: true }, expected: { isUid: true } },
    { query: { isUid: false }, expected: { isUid: false } },
    {
      query: { client: "web", isUid: true },
      expected: { client: "web", isUid: true },
    },
  ])("parses $query", ({ query, expected }) => {
    expect(GetProfileQuerySchema.parse(query)).toEqual(expected);
  });

  it.for([
    { isUid: "true" },
    { isUid: "yes" },
    { isUid: 1 },
    { client: "desktop" },
  ])("rejects %o", (query) => {
    expect(GetProfileQuerySchema.safeParse(query).success).toBe(false);
  });
});
