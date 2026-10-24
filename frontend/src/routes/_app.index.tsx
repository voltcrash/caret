import { wasmUrl } from "@oxytype/typing-engine/asset";
import { createFileRoute } from "@tanstack/solid-router";
import { englishHash } from "virtual:language-hashes";

import { publicEnv } from "../app/public-env";
import { TypingLeaf } from "../features/typing/page";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    links: [
      { rel: "canonical", href: `${publicEnv.origin}/` },
      {
        rel: "preload",
        as: "fetch",
        type: "application/wasm",
        crossorigin: "anonymous",
        href: wasmUrl,
      },
      // The default 2.5 kB word list can arrive while JavaScript hydrates.
      // Other language preferences still select and verify their own list.
      ...(englishHash === undefined
        ? []
        : [
            {
              rel: "preload",
              as: "fetch" as const,
              type: "application/json",
              crossorigin: "anonymous" as const,
              href: `/languages/english.json?v=${englishHash.slice(0, 16)}`,
            },
          ]),
    ],
    meta: [
      { title: "Oxytype | A minimalistic, customizable typing test" },
      {
        name: "description",
        content: "A minimalistic, customizable typing test.",
      },
      {
        property: "og:title",
        content: "Oxytype | A minimalistic, customizable typing test",
      },
    ],
  }),
  component: TypingLeaf,
});
