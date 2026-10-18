import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createTestRuntime } from "./helpers";
import { withRuntime } from "../../src/runtime/env";
import * as UserDAL from "../../src/dal/user";
import { atomicUser, mutateUser, stage } from "../../src/db/mutation";
import { statement } from "../../src/db/client";

describe("D1 user mutations", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  beforeAll(async () => {
    test = await createTestRuntime();
  });
  afterAll(async () => {
    await test?.dispose();
  });
  it("checks existence inside and outside a user's atomic draft", async () => {
    await withRuntime(test.env, async () => {
      await UserDAL.addUser("Exists", "exists@example.com", "exists");
      await UserDAL.addUser("Other", "other@example.com", "other");
      expect(await UserDAL.exists("exists")).toBe(true);
      expect(await UserDAL.exists("missing")).toBe(false);
      await atomicUser("exists", async () => {
        expect(await UserDAL.exists("exists")).toBe(true);
        expect(await UserDAL.exists("other")).toBe(true);
        expect(await UserDAL.exists("missing")).toBe(false);
      });
    });
  });
  it("serializes concurrent increments without lost updates", async () => {
    await withRuntime(test.env, async () => {
      await UserDAL.addUser(
        "Concurrent",
        "concurrent@example.com",
        "concurrent",
      );
      await Promise.all([
        UserDAL.incrementXp("concurrent", 10),
        UserDAL.incrementXp("concurrent", 20),
        UserDAL.incrementXp("concurrent", 30),
      ]);
      expect((await UserDAL.getUser("concurrent", "test")).xp).toBe(60);
    });
  });
  it("rolls back user changes together with dependent writes", async () => {
    await withRuntime(test.env, async () => {
      await expect(
        atomicUser("concurrent", async () => {
          await UserDAL.incrementXp("concurrent", 100);
          await stage(
            statement("INSERT INTO mutation_guards(id,valid) VALUES('fail',0)"),
          );
        }),
      ).rejects.toThrow(/Concurrent update/);
      expect((await UserDAL.getUser("concurrent", "test")).xp).toBe(60);
    });
  });
  it("enforces bounded arrays within the versioned update", async () => {
    await withRuntime(test.env, async () => {
      await mutateUser("concurrent", (user) => {
        user.tags = Array.from({ length: 14 }, (_, i) => ({
          _id: String(i),
          name: String(i),
          personalBests: {
            time: {},
            words: {},
            quote: {},
            zen: {},
            custom: {},
          },
        }));
      });
      const attempts = await Promise.allSettled([
        UserDAL.addTag("concurrent", "first"),
        UserDAL.addTag("concurrent", "second"),
      ]);
      expect(
        attempts.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(await UserDAL.getTags("concurrent")).toHaveLength(15);
    });
  });
});
