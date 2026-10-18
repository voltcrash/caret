import { createFileRoute } from "@tanstack/solid-router";
import { authHandler } from "../server/auth.server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: { ANY: async ({ request }) => await authHandler(request) },
  },
});
