import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createTestRuntime } from "./helpers";
import { withRuntime } from "../../src/runtime/env";
import * as Users from "../../src/dal/user";
import * as Configs from "../../src/dal/config";
import * as Presets from "../../src/dal/preset";
import * as Results from "../../src/dal/result";
import * as Public from "../../src/dal/public";
import * as Blocklist from "../../src/dal/blocklist";
import { deleteUserAccount } from "../../src/services/user-deletion";
import { atomicUser, mutateUser } from "../../src/db/mutation";
import { BASE_CONFIGURATION } from "../../src/constants/base-configuration";
import type { DBResult } from "../../src/utils/result";
import { statement } from "../../src/db/client";
import { newId } from "../../src/utils/id";

describe("PostgreSQL data contracts", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  beforeAll(async () => {
    test = await createTestRuntime();
    await withRuntime(test.env, async () => {
      for (const uid of ["owner", "other", "dedupe", "delete"]) {
        await Users.addUser(uid, `${uid}@example.com`, uid);
      }
    });
  });
  afterAll(async () => await test.dispose());
  it("merges concurrent config patches and removes obsolete settings", async () => {
    await withRuntime(test.env, async () => {
      await Promise.all([
        Configs.saveConfig("owner", { theme: "serika" }),
        Configs.saveConfig("owner", { mode: "time" }),
      ]);
      expect((await Configs.getConfig("owner"))?.config).toMatchObject({
        theme: "serika",
        mode: "time",
      });
    });
  });
  it("removes saved ad settings when updating a legacy config", async () => {
    await withRuntime(test.env, async () => {
      await statement(
        "INSERT INTO configs(uid,id,data) VALUES(?,?,?)",
        "dedupe",
        newId(),
        JSON.stringify({ ads: "on", enableAds: true, theme: "nord" }),
      ).run();

      await Configs.saveConfig("dedupe", { time: 60 });

      expect((await Configs.getConfig("dedupe"))?.config).toEqual({
        theme: "nord",
        time: 60,
      });
    });
  });
  it("caps concurrent preset creation and enforces ownership", async () => {
    await withRuntime(test.env, async () => {
      const attempts = await Promise.allSettled(
        Array.from({ length: 11 }, async (_, i) =>
          Presets.addPreset("owner", {
            name: `preset${i}`,
            config: { mode: "time" },
          }),
        ),
      );
      expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(10);
      const preset = (await Presets.getPresets("owner"))[0];
      if (preset === undefined) throw new Error("Missing preset");
      await Presets.editPreset("owner", {
        _id: preset._id,
        name: "updated",
        settingGroups: ["behavior"],
      });
      expect((await Presets.getPresets("owner"))[0]?.settingGroups).toEqual([
        "behavior",
      ]);
      await expect(Presets.removePreset("other", preset._id)).rejects.toThrow(
        "Preset not found",
      );
    });
  });

  it("rolls back duplicate results with XP and public counters", async () => {
    await withRuntime(test.env, async () => {
      const save = async (): Promise<void> => {
        await atomicUser("dedupe", async () => {
          await Users.incrementXp("dedupe", 10);
          await Public.updateStats(0, 5);
          await Results.addResult("dedupe", {
            _id: newId(),
            uid: "dedupe",
            timestamp: 10,
            mode: "time",
            mode2: "15",
            language: "english",
            wpm: 80,
            acc: 100,
            submissionHash: "same",
          } as unknown as DBResult);
        });
      };
      const attempts = await Promise.allSettled([save(), save()]);
      expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect((await Users.getUser("dedupe", "test")).xp).toBe(10);
      expect((await Public.getTypingStats()).testsCompleted).toBe(1);
      const result = await Results.getLastResult("dedupe");
      await expect(Results.getResult("other", result._id)).rejects.toThrow(
        "Result not found",
      );
    });
  });
  it("rejects results for missing users", async () => {
    await withRuntime(test.env, async () => {
      await expect(
        Results.addResult("missing", {
          _id: newId(),
          timestamp: 10,
          mode: "time",
          mode2: "15",
          wpm: 80,
          acc: 100,
        } as unknown as DBResult),
      ).rejects.toThrow("User not found");
    });
  });
  it("deletes application and auth data together, retaining banned identity hashes", async () => {
    await withRuntime(test.env, async () => {
      await mutateUser("delete", (user) => {
        user.banned = true;
      });
      await test.db.prepare(
        "INSERT INTO auth_users(id,name,email,created_at,updated_at) VALUES('delete','delete','delete@example.com','1970-01-01','1970-01-01')",
      ).run();
      await test.db.prepare(
        "INSERT INTO auth_sessions(id,token,user_id,expires_at,created_at,updated_at) VALUES('session','token','delete','2099-01-01','1970-01-01','1970-01-01')",
      ).run();
      await Configs.saveConfig("delete", { theme: "serika" });
      await deleteUserAccount("delete", BASE_CONFIGURATION);
      await deleteUserAccount("delete", BASE_CONFIGURATION);
      expect(await Users.exists("delete")).toBe(false);
      expect(await Configs.getConfig("delete")).toBe(null);
      expect(
        await test.db.prepare(
          "SELECT count(*) AS count FROM auth_sessions",
        ).first("count"),
      ).toBe(0);
      expect(await Blocklist.contains({ email: "DELETE@example.com" })).toBe(
        true,
      );
    });
  });
  it("resets all owned history atomically; refuses banned resets", async () => {
    await withRuntime(test.env, async () => {
      await Users.addUser("Reset", "reset@example.com", "reset");
      await Configs.saveConfig("reset", { theme: "serika" });
      await Presets.addPreset("reset", { name: "preset", config: {} });
      await mutateUser("reset", (user) => {
        user.xp = 100;
      });
      await expect(
        atomicUser("reset", async () => {
          await Users.resetUser("reset");
          throw new Error("rollback reset");
        }),
      ).rejects.toThrow("rollback reset");
      expect((await Users.getUser("reset", "test")).xp).toBe(100);
      expect(await Presets.getPresets("reset")).toHaveLength(1);
      await Users.resetUser("reset");
      expect((await Users.getUser("reset", "test")).xp).toBe(0);
      expect(await Presets.getPresets("reset")).toHaveLength(0);
      expect(await Configs.getConfig("reset")).toBeNull();
      await mutateUser("reset", (user) => {
        user.banned = true;
      });
      await expect(Users.resetUser("reset")).rejects.toThrow("Banned users");
    });
  });
});
