import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { Plugin } from "vite";
import {
  initSync,
  WasmContent,
} from "../../packages/typing-engine/generated/engine.js";
import { projectEngineConfig } from "@caret/typing-engine/config";
import { encodeText, decodeText } from "@caret/typing-engine/text";
import type { Snapshot } from "../../packages/typing-engine/generated/types/Snapshot";

/** Prepare real first-visit words at build time, never in a database request. */
export function initialTyping(): Plugin {
  return {
    name: "caret-initial-typing",
    resolveId(id) {
      if (id === "virtual:initial-typing") return "\0virtual:initial-typing";
      return undefined;
    },
    load(id) {
      if (id !== "\0virtual:initial-typing") return;
      const bytes = readFileSync(
        new URL(
          "../../packages/typing-engine/generated/engine_bg.wasm",
          import.meta.url,
        ),
      );
      initSync({ module: new WebAssembly.Module(bytes) });
      const language = JSON.parse(
        readFileSync(
          new URL("../static/languages/english.json", import.meta.url),
          "utf8",
        ),
      ) as { name: string; words: string[]; bcp47?: string };
      const config = projectEngineConfig({});
      const seed = 185374211;
      const content = new WasmContent(1);
      try {
        content.prepare(
          JSON.stringify({
            config,
            language: {
              name: language.name,
              bcp47: language.bcp47 ?? null,
              words: language.words.map(encodeText),
              rightToLeft: null,
              joiningScript: false,
              originalPunctuation: false,
              noLazyMode: false,
              additionalAccents: [],
            },
            custom: null,
            random: { kind: "seeded", state: seed },
            quotes: null,
            polyglot: [],
            selectedQuoteId: 0,
            favoriteQuoteIds: [],
            sections: [],
          }),
          false,
        );
        content.generate(false);
        const session = content.session(false);
        let words: string[];
        try {
          words = (JSON.parse(session.snapshot()) as Snapshot).words
            .slice(0, 60)
            .map(decodeText);
        } finally {
          session.dispose();
          session.free();
        }
        const engineHash = createHash("sha256").update(bytes).digest("hex");
        const languageHash = createHash("sha256")
          .update(JSON.stringify(language))
          .digest("hex");
        const key = createHash("sha256")
          .update(JSON.stringify([engineHash, languageHash, config]))
          .digest("hex");
        return `export const initialTyping = ${JSON.stringify({ seed, key, words, engineHash })};`;
      } finally {
        content.dispose();
        content.free();
      }
    },
  };
}
