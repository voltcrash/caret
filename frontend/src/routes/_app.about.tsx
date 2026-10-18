import { createFileRoute } from "@tanstack/solid-router";

import { publicEnv } from "../app/public-env";
import { prefetch } from "../data/prefetch";
import { speedHistogramOptions, typingStatsOptions } from "../data/public";
import { AboutPage } from "../features/about/page";

export const Route = createFileRoute("/_app/about")({
  // Read failures render inline instead of failing the route.
  loader: async ({ context }) => {
    if (import.meta.env.OXYTYPE_OFFLINE) return;
    await prefetch(
      context.queryClient,
      typingStatsOptions(),
      speedHistogramOptions(),
    );
  },
  head: () => ({
    links: [{ rel: "canonical", href: `${publicEnv.origin}/about` }],
    meta: [
      { title: "About | Oxytype" },
      { property: "og:title", content: "About | Oxytype" },
      { property: "og:url", content: `${publicEnv.origin}/about` },
      {
        name: "description",
        content: "About Oxytype, an independent, customizable typing test.",
      },
    ],
  }),
  component: () => (
    <div class="page pageAbout full-width" id="pageAbout">
      <AboutPage />
    </div>
  ),
});
