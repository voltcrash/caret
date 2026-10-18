import { createFileRoute } from "@tanstack/solid-router";
import { unknownApi } from "../server/http.server";

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: { ANY: async ({ request }) => await unknownApi(request) },
  },
});
