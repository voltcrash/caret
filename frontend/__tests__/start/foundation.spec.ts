import { describe, expect, it } from "vite-plus/test";
import { dehydrate } from "@tanstack/solid-query";
import { createQueryClient } from "../../src/app/query-client";

describe("Start ownership boundaries", () => {
  it("isolates requests and only dehydrates explicitly safe public data", () => {
    const a = createQueryClient();
    const b = createQueryClient();
    a.setQueryDefaults(["public"], { meta: { ssrSafe: true } });
    a.setQueryData(["public"], { testsCompleted: 7 });
    a.setQueryData(["session"], { token: "must-never-serialize" });
    expect(b.getQueryCache().getAll()).toHaveLength(0);
    const payload = dehydrate(a);
    expect(payload.queries).toHaveLength(1);
    expect(JSON.stringify(payload)).not.toContain("must-never-serialize");
    a.clear();
    b.clear();
  });

});
