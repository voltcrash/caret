import { createAppOwned } from "../../../app/application";
import { projectEngineConfig } from "@caret/typing-engine/config";
import type { Config } from "@caret/schemas/configs";
import { initialContentConfig } from "./content";
import type { InitialTypingSnapshot } from "../../../ts/config/typing-preview";

export const initialTypingState = createAppOwned(() => {
  type SeedState =
    | { phase: "empty" }
    | { phase: "available"; snapshot: InitialTypingSnapshot }
    | { phase: "consumed"; engineHash: string };
  let state: SeedState = { phase: "empty" };
  return {
    initialize: (value: InitialTypingSnapshot) => {
      state =
        state.phase === "consumed"
          ? { phase: "consumed", engineHash: value.engineHash ?? "" }
          : { phase: "available", snapshot: value };
    },
    seed: (key: string): number | undefined => {
      if (state.phase === "consumed") return undefined;
      const initial = state.phase === "available" ? state.snapshot : undefined;
      // Remounting or later reverting settings must not replay the first test.
      state = { phase: "consumed", engineHash: initial?.engineHash ?? "" };
      return initial?.version === 2 && initial.key === key
        ? initial.seed
        : undefined;
    },
    engineHash: () =>
      state.phase === "available"
        ? (state.snapshot.engineHash ?? "")
        : state.phase === "consumed"
          ? state.engineHash
          : "",
  };
});

export async function initialContentKey(
  config: Config,
  languageHash: string,
  engineHash: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(
    JSON.stringify([
      engineHash,
      languageHash,
      initialContentConfig(projectEngineConfig(config)),
    ]),
  );
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
