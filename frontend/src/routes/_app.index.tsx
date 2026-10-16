import { createFileRoute } from "@tanstack/solid-router";

import { publicEnv } from "../app/public-env";
import { TypingLeaf } from "../features/typing/page";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    links: [{ rel: "canonical", href: `${publicEnv.origin}/` }],
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
