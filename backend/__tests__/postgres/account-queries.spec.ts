import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { createTestRuntime, seedUser } from "./helpers";
import { runtime, withRuntime } from "../../src/runtime/env";
import { statement } from "../../src/db/client";
import { mutateUser } from "../../src/db/mutation";
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

});
