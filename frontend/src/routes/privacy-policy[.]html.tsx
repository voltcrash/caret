import { createFileRoute } from "@tanstack/solid-router";

import { publicEnv } from "../app/public-env";
import { PrivacyPolicy } from "../ts/components/standalone/PrivacyPolicy";

const title = "Privacy Policy | Oxytype";

/** Static policy at its published URL; fully server-rendered. */
export const Route = createFileRoute("/privacy-policy.html")({
  head: () => ({
    links: [
      { rel: "canonical", href: `${publicEnv.origin}/privacy-policy.html` },
    ],
    meta: [
      { title },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: title },
      { name: "twitter:title", content: title },
    ],
  }),
  component: () => (
    <div class="flex justify-center leading-[1.25]">
      <div id="app" class="content-grid">
        <PrivacyPolicy />
      </div>
    </div>
  ),
});
