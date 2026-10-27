import { wasmUrl } from "@caret/typing-engine/asset";
import { createFileRoute } from "@tanstack/solid-router";
import { englishHash } from "virtual:language-hashes";

import { homeDescription, homeTitle, pageHead } from "../app/seo";
import {
  homeStructuredData,
  structuredDataScript,
} from "../app/structured-data";
import { TypingLeaf } from "../features/typing/page";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    ...pageHead(homeTitle, homeDescription, "/"),
    scripts: [structuredDataScript(homeStructuredData())],
    links: [
      ...pageHead(homeTitle, homeDescription, "/").links,
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
  }),
  component: TypingLeaf,
});
