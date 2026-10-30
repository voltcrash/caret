import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { createTestRuntime, seedUser } from "./helpers";
import { runtime, withRuntime } from "../../src/runtime/env";
import { statement } from "../../src/db/client";
import { atomicUser, mutateUser } from "../../src/db/mutation";
import * as Users from "../../src/dal/user";

describe("account queries through PostgreSQL", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  beforeAll(async () => {
    test = await createTestRuntime();
    for (const uid of ["projection", "lookup", "ips", "ranked", "unranked"]) {
      await seedUser(test.env, uid);
    }
  });
  afterAll(async () => await test?.dispose());

  it("returns only requested JSON fields over the wire, preserving missing and null keys", async () => {
    await withRuntime(test.env, async () => {
      await mutateUser("projection", (user) => {
        user.banned = false;
        user.note = "private history".repeat(10_000);
      });
      await statement(
        `UPDATE users SET data=jsonb_set(data-'personalBests','{premium}','null'::jsonb) WHERE uid=?`,
        "projection",
      ).run();
      const query = vi.spyOn(runtime().sql, "query");
      try {
        expect(
          await Users.getPartialUser("projection", "test", [
            "banned",
            "xp",
            "premium",
          ]),
        ).toEqual({ banned: false, premium: null });
        expect(query).toHaveBeenCalledTimes(1);
        expect(await query.mock.results[0]?.value).toHaveProperty("rows", [
          [{ banned: false, premium: null }],
        ]);
      } finally {
        query.mockRestore();
      }
      expect(await Users.getPartialUser("projection", "test", [])).toEqual({});
      expect(
        await Users.getPartialUser("projection", "test", ["personalBests"]),
      ).toEqual({
        personalBests: { time: {}, words: {}, quote: {}, zen: {}, custom: {} },
      });
      await expect(
        Users.getPartialUser("missing", "test", []),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  it("reads name lookups once and returns isolated values from an active draft", async () => {
    await withRuntime(test.env, async () => {
      const before = runtime().metrics.dbStatements;
      expect(await Users.findByName("LOOKUP")).toMatchObject({ uid: "lookup" });
      expect(runtime().metrics.dbStatements - before).toBe(1);
      expect(await Users.findByName("missing")).toBeUndefined();
      await atomicUser("lookup", async () => {
        await mutateUser("lookup", (user) => {
          user.xp = 123;
          user.ips = ["draft"];
        });
        expect(await Users.findByName("lookup")).toMatchObject({ xp: 123 });
        const start = runtime().metrics.dbStatements;
        const partial = await Users.getPartialUser("lookup", "test", [
          "xp",
          "ips",
        ]);
        expect(partial).toEqual({ xp: 123, ips: ["draft"] });
        partial.ips?.push("must not mutate draft");
        expect(await Users.getPartialUser("lookup", "test", ["ips"])).toEqual({
          ips: ["draft"],
        });
        expect(runtime().metrics.dbStatements).toBe(start);
      });
    });
  });

});
