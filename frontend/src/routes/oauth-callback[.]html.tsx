import { createFileRoute } from "@tanstack/solid-router";

import { pageHead } from "../app/seo";
import { OAuthCallback } from "../features/auth/callback";

export const Route = createFileRoute("/oauth-callback.html")({
  head: () =>
    pageHead(
      "Sign in | Caret",
      "Sign in on Caret.",
      "/oauth-callback.html",
      false,
    ),
  component: OAuthCallback,
});
