import { createFileRoute } from "@tanstack/solid-router";
import { legacyHttp } from "../server/legacy-http.server";

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: { ANY: async ({ request }) => await legacyHttp(request) },
  },
});
