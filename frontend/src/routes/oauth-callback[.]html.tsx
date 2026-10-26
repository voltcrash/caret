import { createFileRoute } from "@tanstack/solid-router";

import { OAuthCallback } from "../features/auth/callback";

export const Route = createFileRoute("/oauth-callback.html")({
  head: () => ({
    meta: [
      { title: "Sign in | Caret" },
      { name: "description", content: "Sign in on Caret." },
    ],
  }),
  component: OAuthCallback,
});
