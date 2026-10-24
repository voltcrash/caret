import { describe, expect, it } from "vite-plus/test";
import { challengeSetup, getChallenges } from "../src/index";

// Requirement checks live in Rust (crates/typing-engine/src/challenges.rs).
describe("shared challenge setup", () => {
  it("produces a setup for every catalog item without mutating it", () => {
    for (const entry of getChallenges()) {
      const before = structuredClone(entry);
      const setup = challengeSetup(entry);
      if (entry.settings.type !== "other") {
        expect(setup.config.mode).toBeDefined();
      }
      if (entry.settings.type === "customText") {
        expect(setup.customText?.limit.value).toBe(
          entry.settings.parameters.limit,
        );
      }
      if (entry.settings.type === "script") {
        expect(setup.script).toBe(entry.settings.parameters.script);
      }
      expect(entry).toEqual(before);
    }
  });
});
