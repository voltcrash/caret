import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { ChallengeNameSchema } from "@oxytype/schemas/challenges";
import { getChallenge, getChallenges } from "../src/index";

describe("challenge catalog", () => {
  it("resolves every accepted challenge name to a unique definition", () => {
    const names = getChallenges().map((challenge) => challenge.name);
    expect(names.toSorted()).toEqual(
      [...ChallengeNameSchema.values].toSorted(),
    );
    expect(new Set(names).size).toBe(names.length);
    for (const name of ChallengeNameSchema.values) {
      expect(getChallenge(name).name).toBe(name);
    }
  });

  it("has a local asset for every script challenge", () => {
    for (const { settings } of getChallenges()) {
      if (settings.type !== "script") continue;
      const asset = resolve(
        __dirname,
        "../../../frontend/static/challenges",
        settings.parameters.script,
      );
      expect(existsSync(asset), asset).toBe(true);
    }
  });
});
