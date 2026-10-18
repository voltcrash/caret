import { createFileRoute } from "@tanstack/solid-router";
import { serveHealth, unknownApi } from "../server/http.server";

export const Route = createFileRoute("/api/")({
  server: {
    handlers: {
      GET: async ({ request }) => await serveHealth(request),
      ANY: async ({ request }) => await unknownApi(request),
    },
  },
});
