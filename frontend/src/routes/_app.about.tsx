import { createFileRoute } from "@tanstack/solid-router";

import { pageHead } from "../app/seo";
import { AboutCaret } from "../features/discover/about";

export const Route = createFileRoute("/_app/about")({
  head: () =>
    pageHead(
      "About Caret | Free Typing Test & Online Typing Practice",
      "Learn about Caret, a free, open-source typing test. Explore typing modes, customization, practice guides and answers to common questions.",
      "/about",
    ),
  component: AboutCaret,
});
